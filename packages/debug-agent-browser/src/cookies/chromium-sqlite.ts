// HACK: Fallback for Chromium cookie extraction when CDP (headless browser) fails.
// Reads the SQLite cookie database directly and decrypts values using
// platform-specific key retrieval (macOS Keychain, Linux secret-tool, Windows DPAPI).
import { execFile } from "node:child_process";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { promisify } from "node:util";
import { z } from "zod";
import { chromiumConfig } from "./browser-config";
import {
  CHROMIUM_META_VERSION_HASH_PREFIX,
  DPAPI_PREFIX_LENGTH_BYTES,
  PBKDF2_ITERATIONS_DARWIN,
  PBKDF2_ITERATIONS_LINUX,
} from "./constants";
import { deriveKey, decryptAes128Cbc, decryptAes256Gcm } from "./utils/crypto";
import { normalizeChromiumExpiration, normalizeChromiumSameSite } from "./utils/chromium-normalize";
import {
  CookieDatabaseNotFoundError,
  CookieDecryptionKeyError,
  ExtractionError,
  UnknownError,
} from "./errors";
import { SqliteClient } from "./sqlite-client";
import { Cookie, type ChromiumBrowser, type ChromiumBrowserKey } from "./types";
import { defaultLogger, type Logger } from "./logger";

const execFileAsync = promisify(execFile);

const localStateSchema = z.object({
  os_crypt: z.object({
    encrypted_key: z.string(),
  }),
});

export interface DecryptFn {
  (encrypted: Uint8Array): string | undefined;
}

export interface ChromiumKeyProvider {
  buildDecryptor(browserKey: ChromiumBrowserKey, stripHashPrefix: boolean): Promise<DecryptFn>;
}

export const chromiumKeyProviderDarwin: ChromiumKeyProvider = {
  buildDecryptor: async (browserKey, stripHashPrefix) => {
    const config = chromiumConfig(browserKey);
    let password: string;
    try {
      const { stdout } = await execFileAsync("security", [
        "find-generic-password",
        "-w",
        "-s",
        config.keychainService,
      ]);
      password = stdout.trim();
    } catch {
      throw new CookieDecryptionKeyError(browserKey, "darwin");
    }

    if (!password) throw new CookieDecryptionKeyError(browserKey, "darwin");

    const key = deriveKey(password, PBKDF2_ITERATIONS_DARWIN);
    return (encrypted: Uint8Array) => decryptAes128Cbc(encrypted, [key], stripHashPrefix);
  },
};

export const chromiumKeyProviderLinux: ChromiumKeyProvider = {
  buildDecryptor: async (browserKey, stripHashPrefix) => {
    const config = chromiumConfig(browserKey);
    const lookups: ReadonlyArray<readonly string[]> = [
      ["secret-tool", "lookup", "application", config.linuxSecretLabel],
      ["secret-tool", "lookup", "xdg:schema", "chrome_libsecret_os_crypt_password_v2"],
      ["secret-tool", "lookup", "xdg:schema", "chrome_libsecret_os_crypt_password_v1"],
    ];

    let password = "";
    for (const args of lookups) {
      try {
        const { stdout } = await execFileAsync(args[0]!, args.slice(1));
        const result = stdout.trim();
        if (result) {
          password = result;
          break;
        }
      } catch {
        // try next lookup
      }
    }

    if (!password) password = "peanuts";

    const candidatePasswords = new Set<string>([password, "peanuts", ""]);
    const candidateKeys = Array.from(candidatePasswords).map((candidateKey) =>
      deriveKey(candidateKey, PBKDF2_ITERATIONS_LINUX),
    );
    return (encrypted: Uint8Array) => decryptAes128Cbc(encrypted, candidateKeys, stripHashPrefix);
  },
};

export const chromiumKeyProviderWin32: ChromiumKeyProvider = {
  buildDecryptor: async (browserKey, stripHashPrefix) => {
    const config = chromiumConfig(browserKey);
    const localStatePath = path.join(os.homedir(), config.localStatePath);

    let localStateContent: string;
    try {
      localStateContent = await fs.readFile(localStatePath, "utf-8");
    } catch {
      throw new CookieDecryptionKeyError(browserKey, "win32");
    }

    let localState: z.infer<typeof localStateSchema>;
    try {
      localState = localStateSchema.parse(JSON.parse(localStateContent));
    } catch {
      throw new CookieDecryptionKeyError(browserKey, "win32");
    }

    const encodedKey = localState.os_crypt.encrypted_key;
    const encryptedKey = Buffer.from(encodedKey, "base64");
    const base64Key = encryptedKey.subarray(DPAPI_PREFIX_LENGTH_BYTES).toString("base64");

    const psCommand = `Add-Type -AssemblyName System.Security; $encrypted = [Convert]::FromBase64String('${base64Key}'); $decrypted = [System.Security.Cryptography.ProtectedData]::Unprotect($encrypted, $null, 'CurrentUser'); [Convert]::ToBase64String($decrypted)`;

    let result: string;
    try {
      const { stdout } = await execFileAsync("powershell", ["-Command", psCommand]);
      result = stdout.trim();
    } catch {
      throw new CookieDecryptionKeyError(browserKey, "win32");
    }

    if (!result) throw new CookieDecryptionKeyError(browserKey, "win32");

    const masterKey = Buffer.from(result, "base64");
    return (encrypted: Uint8Array) => decryptAes256Gcm(encrypted, masterKey, stripHashPrefix);
  },
};

export const defaultChromiumKeyProvider = (): ChromiumKeyProvider => {
  const platform = os.platform();
  if (platform === "darwin") return chromiumKeyProviderDarwin;
  if (platform === "win32") return chromiumKeyProviderWin32;
  return chromiumKeyProviderLinux;
};

const exists = async (filePath: string): Promise<boolean> => {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
};

export class ChromiumSqliteFallback {
  constructor(
    private readonly sqliteClient: SqliteClient = new SqliteClient(),
    private readonly keyProvider: ChromiumKeyProvider = defaultChromiumKeyProvider(),
    private readonly logger: Logger = defaultLogger,
  ) {}

  private async resolveCookieDbPath(profilePath: string, browserKey: string): Promise<string> {
    const networkPath = path.join(profilePath, "Network", "Cookies");
    if (await exists(networkPath)) return networkPath;

    const legacyPath = path.join(profilePath, "Cookies");
    if (await exists(legacyPath)) return legacyPath;

    throw new CookieDatabaseNotFoundError(browserKey);
  }

  private async readMetaVersion(databasePath: string): Promise<number> {
    let rows: Array<Record<string, unknown>>;
    try {
      rows = await this.sqliteClient.query(
        databasePath,
        "SELECT value FROM meta WHERE key = 'version'",
        "chromium",
      );
    } catch {
      return 0;
    }

    const value = rows[0]?.value;
    if (typeof value === "number") return Math.floor(value);
    if (typeof value === "bigint") return Math.floor(Number(value));
    if (typeof value === "string") {
      const parsed = Number.parseInt(value, 10);
      return Number.isFinite(parsed) ? parsed : 0;
    }
    return 0;
  }

  async extract(browser: ChromiumBrowser): Promise<Cookie[]> {
    let databasePath: string;
    let copyResult: Awaited<ReturnType<SqliteClient["copyToTemp"]>>;
    let decryptValue: DecryptFn;
    let cookieRows: Array<Record<string, unknown>>;

    try {
      databasePath = await this.resolveCookieDbPath(browser.profilePath, browser.key);
      copyResult = await this.sqliteClient.copyToTemp(
        databasePath,
        `cookies-sqlite-${browser.key}-`,
        "Cookies",
        browser.key,
      );
    } catch (cause) {
      throw new ExtractionError(new UnknownError(cause));
    }

    try {
      const metaVersion = await this.readMetaVersion(copyResult.tempDatabasePath);
      const stripHashPrefix = metaVersion >= CHROMIUM_META_VERSION_HASH_PREFIX;
      decryptValue = await this.keyProvider.buildDecryptor(browser.key, stripHashPrefix);

      cookieRows = await this.sqliteClient.query(
        copyResult.tempDatabasePath,
        `SELECT name, value, host_key, path, expires_utc, samesite, encrypted_value, is_secure, is_httponly FROM cookies ORDER BY expires_utc DESC`,
        browser.key,
      );
    } catch (cause) {
      await copyResult.cleanup();
      throw new ExtractionError(new UnknownError(cause));
    }

    await copyResult.cleanup();

    const cookies: Cookie[] = [];
    for (const row of cookieRows) {
      const cookieName = typeof row.name === "string" ? row.name : undefined;
      if (!cookieName) continue;

      const hostKey = typeof row.host_key === "string" ? row.host_key : undefined;
      if (!hostKey) continue;

      let cookieValue = typeof row.value === "string" ? row.value : undefined;
      if (!cookieValue || cookieValue.length === 0) {
        const encrypted =
          row.encrypted_value instanceof Uint8Array ? row.encrypted_value : undefined;
        if (!encrypted) continue;
        const decrypted = decryptValue(encrypted);
        if (decrypted === undefined) continue;
        cookieValue = decrypted;
      }

      const rawExpiry = row.expires_utc;
      const expires = normalizeChromiumExpiration(
        typeof rawExpiry === "number" ||
          typeof rawExpiry === "bigint" ||
          typeof rawExpiry === "string"
          ? rawExpiry
          : undefined,
      );

      cookies.push(
        Cookie.make({
          name: cookieName,
          value: cookieValue,
          domain: hostKey,
          path: typeof row.path === "string" ? row.path : "/",
          ...(expires !== undefined ? { expires } : {}),
          secure: Number(row.is_secure) !== 0,
          httpOnly: Number(row.is_httponly) !== 0,
          sameSite: normalizeChromiumSameSite(row.samesite),
        }),
      );
    }

    this.logger.info("Chromium SQLite fallback cookies extracted", {
      browser: browser.key,
      count: cookies.length,
    });

    return cookies;
  }
}
