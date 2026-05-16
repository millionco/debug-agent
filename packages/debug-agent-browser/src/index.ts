export { Browser, runBrowser, type CreatePageResult } from "./browser";
export { diffSnapshots } from "./diff";
export { autoDiscoverCdp, discoverCdpUrl } from "./cdp-discovery";
export {
  findSystemChrome,
  launchSystemChrome,
  killChromeProcess,
  type ChromeProcess,
  type LaunchSystemChromeOptions,
} from "./chrome-launcher";

export { consoleLogger, silentLogger, defaultLogger, type Logger } from "./logger";

export type { Browser as BrowserProfile, BrowserKey, Cookie, ExtractOptions } from "./cookies";

export {
  BrowserError,
  ActionTimeoutError,
  ActionUnknownError,
  BrowserAlreadyOpenError,
  BrowserLaunchError,
  BrowserNotOpenError,
  CdpConnectionError,
  CdpDiscoveryError,
  ChromeNotFoundError,
  ChromeSpawnError,
  ChromeLaunchTimeoutError,
  ChromeProfileNotFoundError,
  McpServerStartError,
  NavigationError,
  RefAmbiguousError,
  RefBlockedError,
  RefNotFoundError,
  RefNotVisibleError,
  SnapshotTimeoutError,
  type ActionError,
  type BrowserErrorTag,
} from "./errors";

export type {
  AriaRole,
  BrowserEngine,
  CreatePageOptions,
  RefEntry,
  RefMap,
  SnapshotDiff,
  SnapshotOptions,
  SnapshotResult,
  SnapshotStats,
} from "./types";
