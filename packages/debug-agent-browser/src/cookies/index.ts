export { Cookies } from "./cookies";
export { Browsers, type BrowserSource } from "./browser-detector";
export { CdpClient, type ExtractCookiesParams } from "./cdp-client";
export { SqliteClient, type SqliteEngine, type CopyToTempResult } from "./sqlite-client";
export {
  registerChromiumSource,
  chromiumPlatformDarwin,
  chromiumPlatformLinux,
  createChromiumPlatformWin32,
  type ChromiumPlatform,
} from "./chromium";
export {
  registerFirefoxSource,
  firefoxPlatformDarwin,
  firefoxPlatformLinux,
  firefoxPlatformWin32,
  parseProfilesIni,
  type FirefoxPlatform,
  type ParsedProfile,
} from "./firefox";
export { registerSafariSource, safariPlatformDarwin, type SafariPlatform } from "./safari";
export {
  ChromiumSqliteFallback,
  chromiumKeyProviderDarwin,
  chromiumKeyProviderLinux,
  chromiumKeyProviderWin32,
  defaultChromiumKeyProvider,
  type ChromiumKeyProvider,
  type DecryptFn,
} from "./chromium-sqlite";
export { createBrowsers } from "./layers";
export { consoleLogger, silentLogger, defaultLogger, type Logger } from "./logger";

export {
  CookieError,
  ExtractionError,
  RequiresFullDiskAccess,
  ListBrowsersError,
  CookieDatabaseNotFoundError,
  CookieDatabaseCopyError,
  CookieDecryptionKeyError,
  CookieReadError,
  CdpConnectionError,
  BrowserSpawnError,
  UnsupportedPlatformError,
  UnsupportedBrowserError,
  UnknownError,
  CdpInvalidResponsePayload,
  DebuggerUrlNotFoundError,
  type CookieErrorTag,
  type ExtractionReason,
} from "./errors";

export {
  BROWSER_CONFIGS,
  configByKey,
  configByBundleId,
  configByDesktopFile,
} from "./browser-config";
export type { BrowserConfig, ChromiumConfig, FirefoxConfig, SafariConfig } from "./browser-config";

export {
  Cookie,
  cookieInputSchema,
  sameSitePolicySchema,
  browserKeySchema,
  chromiumBrowserKeySchema,
  makeChromiumBrowser,
  makeFirefoxBrowser,
  makeSafariBrowser,
  browserKeyOf,
  type BrowserKey,
  type ChromiumBrowserKey,
  type ChromiumBrowser,
  type FirefoxBrowser,
  type SafariBrowser,
  type Browser,
  type CookieData,
  type SameSitePolicy,
  type ExtractOptions,
} from "./types";

import { configByKey } from "./browser-config";
import { browserKeyOf, type Browser } from "./types";

export const browserDisplayName = (browser: Browser): string => {
  const config = configByKey(browserKeyOf(browser));
  return config?.displayName ?? browserKeyOf(browser);
};
