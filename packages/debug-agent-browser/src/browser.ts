import {
  chromium,
  webkit,
  firefox,
  type Browser as PlaywrightBrowser,
  type BrowserContext,
  type Locator,
  type Page,
} from "playwright";
import {
  Browsers,
  Cookies,
  browserKeyOf,
  Cookie,
  createBrowsers,
  type Browser as BrowserProfile,
} from "./cookies";
import {
  CONTENT_ROLES,
  HEADLESS_CHROMIUM_ARGS,
  INTERACTIVE_ROLES,
  NAVIGATION_DETECT_DELAY_MS,
  POST_NAVIGATION_SETTLE_MS,
  REF_PREFIX,
  SNAPSHOT_TIMEOUT_MS,
  VIDEO_HEIGHT_PX,
  VIDEO_WIDTH_PX,
  CDP_CONNECT_TIMEOUT_MS,
} from "./constants";
import {
  BrowserLaunchError,
  CdpConnectionError,
  NavigationError,
  SnapshotTimeoutError,
} from "./errors";
import { defaultLogger, type Logger } from "./logger";
import { toActionError } from "./utils/action-error";
import { compactTree } from "./utils/compact-tree";
import { createLocator } from "./utils/create-locator";
import { getIndentLevel } from "./utils/get-indent-level";
import { parseAriaLine } from "./utils/parse-aria-line";
import { resolveNthDuplicates } from "./utils/resolve-nth-duplicates";
import { computeSnapshotStats } from "./utils/snapshot-stats";
import type {
  BrowserEngine,
  CreatePageOptions,
  RefMap,
  SnapshotOptions,
  SnapshotResult,
} from "./types";

const BROWSER_ENGINES = { chromium, webkit, firefox } as const;

const resolveBrowserType = (engine: BrowserEngine) => BROWSER_ENGINES[engine];

const shouldAssignRef = (role: string, name: string, interactive?: boolean): boolean => {
  if (INTERACTIVE_ROLES.has(role)) return true;
  if (interactive) return false;
  return CONTENT_ROLES.has(role) && name.length > 0;
};

const dedupCookies = (cookies: readonly Cookie[]): Cookie[] => {
  const seen = new Set<string>();
  const result: Cookie[] = [];
  for (const cookie of cookies) {
    const key = `${cookie.name}|${cookie.domain}|${cookie.path}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(cookie);
  }
  return result;
};

const withTimeout = async <T>(
  promise: Promise<T>,
  timeoutMs: number,
  message: string,
): Promise<T> => {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(message)), timeoutMs);
    promise
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch((cause) => {
        clearTimeout(timer);
        reject(cause);
      });
  });
};

export interface CreatePageResult {
  readonly browser: PlaywrightBrowser;
  readonly context: BrowserContext;
  readonly page: Page;
  readonly isExternalBrowser: boolean;
}

export class Browser {
  private browsersPromise: Promise<Browsers> | undefined;

  constructor(
    private readonly logger: Logger = defaultLogger,
    private readonly cookies: Cookies = new Cookies(),
  ) {}

  private getBrowsers(): Promise<Browsers> {
    this.browsersPromise ??= createBrowsers(this.logger);
    return this.browsersPromise;
  }

  private async resolveDefaultBrowserContext(): Promise<{
    preferredProfile: BrowserProfile | undefined;
  }> {
    const browsers = await this.getBrowsers();
    try {
      const preferredProfile = await browsers.defaultBrowser();
      return { preferredProfile };
    } catch {
      return { preferredProfile: undefined };
    }
  }

  private async extractCookiesForProfile(profile: BrowserProfile): Promise<Cookie[]> {
    try {
      return await this.cookies.extract(profile);
    } catch {
      return [];
    }
  }

  private async extractDefaultBrowserCookies(
    preferredProfile: BrowserProfile | undefined,
  ): Promise<Cookie[]> {
    if (!preferredProfile) return [];
    const cookies = await this.extractCookiesForProfile(preferredProfile);
    return dedupCookies(cookies);
  }

  private async extractCookiesForBrowserKeys(browserKeys: readonly string[]): Promise<Cookie[]> {
    const browsers = await this.getBrowsers();
    let allProfiles: BrowserProfile[];
    try {
      allProfiles = await browsers.list();
    } catch {
      allProfiles = [];
    }

    const matchingProfiles = allProfiles.filter((profile) =>
      browserKeys.includes(browserKeyOf(profile)),
    );

    const results = await Promise.all(
      matchingProfiles.map((profile) => this.extractCookiesForProfile(profile)),
    );

    return dedupCookies(results.flat());
  }

  async createPage(
    url: string | undefined,
    options: CreatePageOptions = {},
  ): Promise<CreatePageResult> {
    const engine = options.browserType ?? "chromium";
    const cdpUrl = engine === "chromium" ? options.cdpUrl : undefined;

    const browserType = resolveBrowserType(engine);
    let playwrightBrowser: PlaywrightBrowser;

    if (cdpUrl) {
      try {
        playwrightBrowser = await withTimeout(
          chromium.connectOverCDP(cdpUrl),
          CDP_CONNECT_TIMEOUT_MS,
          `Connection timed out after ${CDP_CONNECT_TIMEOUT_MS}ms`,
        );
      } catch (cause) {
        throw new CdpConnectionError(
          cdpUrl,
          cause instanceof Error ? cause.message : String(cause),
        );
      }
    } else {
      try {
        playwrightBrowser = await browserType.launch({
          headless: !options.headed,
          executablePath: options.executablePath,
          args: engine === "chromium" && !options.headed ? HEADLESS_CHROMIUM_ARGS : [],
        });
      } catch (cause) {
        throw new BrowserLaunchError(cause instanceof Error ? cause.message : String(cause));
      }
    }

    try {
      const defaultBrowserContext =
        options.cookies === true
          ? await this.resolveDefaultBrowserContext()
          : { preferredProfile: undefined };

      const profileLocale =
        defaultBrowserContext.preferredProfile?._tag === "ChromiumBrowser"
          ? defaultBrowserContext.preferredProfile.locale
          : undefined;

      const contextOptions: Parameters<typeof playwrightBrowser.newContext>[0] = {
        ignoreHTTPSErrors: true,
        ...(options.headed && { viewport: null }),
      };
      if (profileLocale) contextOptions.locale = profileLocale;
      if (options.videoOutputDir) {
        contextOptions.recordVideo = {
          dir: options.videoOutputDir,
          size: { width: VIDEO_WIDTH_PX, height: VIDEO_HEIGHT_PX },
        };
      }

      const isCdpConnected = Boolean(cdpUrl);
      const existingContexts = isCdpConnected ? playwrightBrowser.contexts() : [];
      const context =
        existingContexts.length > 0
          ? existingContexts[0]!
          : await playwrightBrowser.newContext(contextOptions).catch((cause) => {
              throw new BrowserLaunchError(cause instanceof Error ? cause.message : String(cause));
            });

      if (options.cookies && !isCdpConnected) {
        const cookies = Array.isArray(options.cookies)
          ? options.cookies
          : await this.extractDefaultBrowserCookies(defaultBrowserContext.preferredProfile);
        try {
          await context.addCookies(cookies.map((cookie) => cookie.playwrightFormat));
        } catch (cause) {
          throw new BrowserLaunchError(cause instanceof Error ? cause.message : String(cause));
        }
      }

      let page: Page;
      try {
        page = await context.newPage();
      } catch (cause) {
        throw new BrowserLaunchError(cause instanceof Error ? cause.message : String(cause));
      }

      if (url) {
        try {
          await page.goto(url, { waitUntil: options.waitUntil ?? "load" });
        } catch (cause) {
          throw new NavigationError(url, cause instanceof Error ? cause.message : String(cause));
        }
      }

      return { browser: playwrightBrowser, context, page, isExternalBrowser: isCdpConnected };
    } catch (cause) {
      if (!cdpUrl) {
        await playwrightBrowser.close().catch(() => {});
      }
      throw cause;
    }
  }

  async snapshot(page: Page, options: SnapshotOptions = {}): Promise<SnapshotResult> {
    const timeout = options.timeout ?? SNAPSHOT_TIMEOUT_MS;
    const selector = options.selector ?? "body";

    let rawTree: string;
    try {
      rawTree = await page.locator(selector).ariaSnapshot({ timeout });
    } catch (cause) {
      throw new SnapshotTimeoutError(
        selector,
        timeout,
        cause instanceof Error ? cause.message : String(cause),
      );
    }

    const refs: RefMap = {};
    const filteredLines: string[] = [];
    let refCount = 0;

    for (const line of rawTree.split("\n")) {
      if (options.maxDepth !== undefined && getIndentLevel(line) > options.maxDepth) continue;

      const parsed = parseAriaLine(line);
      if (!parsed) {
        if (!options.interactive) filteredLines.push(line);
        continue;
      }

      const { role, name } = parsed;
      if (options.interactive && !INTERACTIVE_ROLES.has(role)) continue;

      if (shouldAssignRef(role, name, options.interactive)) {
        const ref = `${REF_PREFIX}${++refCount}`;
        refs[ref] = { role, name };
        filteredLines.push(`${line} [ref=${ref}]`);
      } else {
        filteredLines.push(line);
      }
    }

    resolveNthDuplicates(refs);

    let tree = filteredLines.join("\n");
    if (options.interactive && refCount === 0) tree = "(no interactive elements)";
    if (options.compact) tree = compactTree(tree);

    const stats = computeSnapshotStats(tree, refs);

    return { tree, refs, stats, locator: createLocator(page, refs) };
  }

  async act(
    page: Page,
    ref: string,
    action: (locator: Locator) => Promise<void>,
    options?: SnapshotOptions,
  ): Promise<SnapshotResult> {
    const before = await this.snapshot(page, options);
    const locator = before.locator(ref);
    try {
      await action(locator);
    } catch (cause) {
      throw toActionError(cause, ref);
    }
    return this.snapshot(page, options);
  }

  async waitForNavigationSettle(page: Page, urlBefore: string): Promise<void> {
    try {
      await page.waitForURL((url) => url.toString() !== urlBefore, {
        timeout: NAVIGATION_DETECT_DELAY_MS,
        waitUntil: "commit",
      });
    } catch {
      // navigation didn't happen — that's fine
    }

    if (page.url() !== urlBefore) {
      await page.waitForLoadState("domcontentloaded").catch(() => {});
      await page.waitForTimeout(POST_NAVIGATION_SETTLE_MS);
    }
  }

  async preExtractCookies(browserKeys?: readonly string[]): Promise<Cookie[]> {
    if (browserKeys && browserKeys.length > 0) {
      return this.extractCookiesForBrowserKeys(browserKeys);
    }
    const { preferredProfile } = await this.resolveDefaultBrowserContext();
    return this.extractDefaultBrowserCookies(preferredProfile);
  }

  async resolveProfile(profileName: string) {
    const browsers = await this.getBrowsers();
    const allBrowsers = await browsers.list();
    return allBrowsers.find(
      (browser): browser is Extract<BrowserProfile, { _tag: "ChromiumBrowser" }> =>
        browser._tag === "ChromiumBrowser" && browser.profileName === profileName,
    );
  }

  async resolveProfilePath(profileName: string): Promise<string | undefined> {
    const profile = await this.resolveProfile(profileName);
    return profile?.profilePath;
  }
}

/**
 * Convenience factory + closer for one-off browser sessions. Mirrors the old
 * `runBrowser` Effect helper.
 */
export const runBrowser = async <A>(
  body: (browser: Browser) => Promise<A>,
  logger: Logger = defaultLogger,
): Promise<A> => {
  const browser = new Browser(logger);
  return body(browser);
};
