import * as fs from "node:fs/promises";
import * as path from "node:path";
import { z } from "zod";
import { CdpClient } from "./cdp-client";
import { SqliteClient } from "./sqlite-client";
import { ChromiumSqliteFallback } from "./chromium-sqlite";
import { ExtractionError, RequiresFullDiskAccess, UnknownError } from "./errors";
import { parseBinaryCookies } from "./utils/binary-cookies";
import { Cookie, type Browser, type SameSitePolicy } from "./types";
import { defaultLogger, type Logger } from "./logger";
import {
  MS_PER_SECOND,
  SAME_SITE_LAX,
  SAME_SITE_NONE,
  SAME_SITE_STRICT,
} from "./constants";

const sqliteBoolSchema = z.union([z.number(), z.bigint()]).transform((value) => Number(value) !== 0);

const firefoxExpirySchema = z
  .union([z.number(), z.bigint(), z.string()])
  .transform((value): number | undefined => {
    const milliseconds = Number(value);
    if (Number.isNaN(milliseconds) || milliseconds <= 0) return undefined;
    return Math.floor(milliseconds / MS_PER_SECOND);
  });

const firefoxSameSiteSchema = z
  .union([z.number(), z.bigint(), z.string()])
  .transform((value): SameSitePolicy | undefined => {
    const numeric = Number(value);
    if (numeric === SAME_SITE_STRICT) return "Strict";
    if (numeric === SAME_SITE_LAX) return "Lax";
    if (numeric === SAME_SITE_NONE) return "None";
    return undefined;
  });

const firefoxCookieRowSchema = z.object({
  name: z.string(),
  value: z.string(),
  host: z.string(),
  path: z.string(),
  expiry: firefoxExpirySchema,
  isSecure: sqliteBoolSchema,
  isHttpOnly: sqliteBoolSchema,
  sameSite: firefoxSameSiteSchema,
});

export class Cookies {
  constructor(
    private readonly cdpClient: CdpClient = new CdpClient(),
    private readonly sqliteClient: SqliteClient = new SqliteClient(),
    private readonly sqliteFallback: ChromiumSqliteFallback = new ChromiumSqliteFallback(),
    private readonly logger: Logger = defaultLogger,
  ) {}

  async extract(browser: Browser): Promise<Cookie[]> {
    if (browser._tag === "ChromiumBrowser") return this.extractChromium(browser);
    if (browser._tag === "FirefoxBrowser") return this.extractFirefox(browser);
    return this.extractSafari(browser);
  }

  private async extractChromium(
    browser: Extract<Browser, { _tag: "ChromiumBrowser" }>,
  ): Promise<Cookie[]> {
    try {
      return await this.cdpClient.extractCookies({
        key: browser.key,
        profilePath: browser.profilePath,
        executablePath: browser.executablePath,
      });
    } catch (cdpError) {
      if (!(cdpError instanceof ExtractionError)) {
        throw new ExtractionError(new UnknownError(cdpError));
      }

      this.logger.warn("CDP extraction failed, trying SQLite fallback", {
        browser: browser.key,
        error: cdpError.message,
      });

      try {
        return await this.sqliteFallback.extract(browser);
      } catch {
        throw cdpError;
      }
    }
  }

  private async extractFirefox(
    browser: Extract<Browser, { _tag: "FirefoxBrowser" }>,
  ): Promise<Cookie[]> {
    const cookieDbPath = path.join(browser.profilePath, "cookies.sqlite");
    const copyResult = await this.sqliteClient
      .copyToTemp(cookieDbPath, "cookies-firefox-", "cookies.sqlite", "firefox")
      .catch((cause) => {
        throw new ExtractionError(new UnknownError(cause));
      });

    try {
      const rows = await this.sqliteClient.query(
        copyResult.tempDatabasePath,
        `SELECT name, value, host, path, expiry, isSecure, isHttpOnly, sameSite FROM moz_cookies ORDER BY expiry DESC`,
        "firefox",
      );

      return rows.map((row) => {
        const parsed = firefoxCookieRowSchema.parse(row);
        return Cookie.make({
          name: parsed.name,
          value: parsed.value,
          domain: parsed.host,
          path: parsed.path || "/",
          expires: parsed.expiry,
          secure: parsed.isSecure,
          httpOnly: parsed.isHttpOnly,
          sameSite: parsed.sameSite,
        });
      });
    } catch (cause) {
      if (cause instanceof ExtractionError) throw cause;
      throw new ExtractionError(new UnknownError(cause));
    } finally {
      await copyResult.cleanup();
    }
  }

  private async extractSafari(
    browser: Extract<Browser, { _tag: "SafariBrowser" }>,
  ): Promise<Cookie[]> {
    if (!browser.cookieFilePath) {
      throw new ExtractionError(new RequiresFullDiskAccess());
    }

    let data: Buffer;
    try {
      data = await fs.readFile(browser.cookieFilePath);
    } catch (cause) {
      throw new ExtractionError(new UnknownError(cause));
    }

    return parseBinaryCookies(data).filter((cookie) => Boolean(cookie.name) && Boolean(cookie.domain));
  }
}
