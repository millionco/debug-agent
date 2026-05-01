export type BrowserErrorTag =
  | "BrowserLaunchError"
  | "SnapshotTimeoutError"
  | "RefNotFoundError"
  | "RefAmbiguousError"
  | "RefBlockedError"
  | "RefNotVisibleError"
  | "ActionTimeoutError"
  | "ActionUnknownError"
  | "NavigationError"
  | "CdpDiscoveryError"
  | "CdpConnectionError"
  | "BrowserAlreadyOpenError"
  | "BrowserNotOpenError"
  | "McpServerStartError"
  | "ChromeNotFoundError"
  | "ChromeSpawnError"
  | "ChromeLaunchTimeoutError"
  | "ChromeProfileNotFoundError";

export abstract class BrowserError extends Error {
  abstract readonly _tag: BrowserErrorTag;
}

export class BrowserLaunchError extends BrowserError {
  readonly _tag = "BrowserLaunchError" as const;
  constructor(public readonly cause: string) {
    super(`Failed to launch browser: ${cause}`);
    this.name = "BrowserLaunchError";
  }
}

export class SnapshotTimeoutError extends BrowserError {
  readonly _tag = "SnapshotTimeoutError" as const;
  constructor(
    public readonly selector: string,
    public readonly timeoutMs: number,
    public readonly cause: string,
  ) {
    super(`Snapshot timed out after ${timeoutMs}ms on selector "${selector}": ${cause}`);
    this.name = "SnapshotTimeoutError";
  }
}

export class RefNotFoundError extends BrowserError {
  readonly _tag = "RefNotFoundError" as const;
  constructor(
    public readonly ref: string,
    public readonly availableRefs: readonly string[],
  ) {
    super(
      availableRefs.length === 0
        ? `Unknown ref "${ref}" (no refs available — page may be empty)`
        : `Unknown ref "${ref}" (available refs: ${availableRefs.join(", ")})`,
    );
    this.name = "RefNotFoundError";
  }
}

export class RefAmbiguousError extends BrowserError {
  readonly _tag = "RefAmbiguousError" as const;
  constructor(
    public readonly ref: string,
    public readonly matchCount: string,
  ) {
    super(`Ref "${ref}" matched ${matchCount} elements. Run snapshot to get updated refs.`);
    this.name = "RefAmbiguousError";
  }
}

export class RefBlockedError extends BrowserError {
  readonly _tag = "RefBlockedError" as const;
  constructor(public readonly ref: string) {
    super(`Ref "${ref}" is blocked by an overlay. Dismiss any modals or banners first.`);
    this.name = "RefBlockedError";
  }
}

export class RefNotVisibleError extends BrowserError {
  readonly _tag = "RefNotVisibleError" as const;
  constructor(public readonly ref: string) {
    super(`Ref "${ref}" is not visible. Try scrolling it into view.`);
    this.name = "RefNotVisibleError";
  }
}

export class ActionTimeoutError extends BrowserError {
  readonly _tag = "ActionTimeoutError" as const;
  constructor(public readonly ref: string) {
    super(`Action on "${ref}" timed out. The element may be blocked or still loading.`);
    this.name = "ActionTimeoutError";
  }
}

export class ActionUnknownError extends BrowserError {
  readonly _tag = "ActionUnknownError" as const;
  constructor(
    public readonly ref: string,
    public readonly cause: string,
  ) {
    super(`Action on "${ref}" failed: ${cause}`);
    this.name = "ActionUnknownError";
  }
}

export class NavigationError extends BrowserError {
  readonly _tag = "NavigationError" as const;
  constructor(
    public readonly url: string,
    public readonly cause: string,
  ) {
    super(`Navigation to "${url}" failed: ${cause}`);
    this.name = "NavigationError";
  }
}

export class CdpDiscoveryError extends BrowserError {
  readonly _tag = "CdpDiscoveryError" as const;
  constructor(public readonly cause: string) {
    super(`CDP discovery failed: ${cause}`);
    this.name = "CdpDiscoveryError";
  }
}

export class CdpConnectionError extends BrowserError {
  readonly _tag = "CdpConnectionError" as const;
  constructor(
    public readonly endpointUrl: string,
    public readonly cause: string,
  ) {
    super(`Failed to connect to CDP endpoint ${endpointUrl}: ${cause}`);
    this.name = "CdpConnectionError";
  }
}

export class BrowserAlreadyOpenError extends BrowserError {
  readonly _tag = "BrowserAlreadyOpenError" as const;
  constructor() {
    super("A browser session is already open");
    this.name = "BrowserAlreadyOpenError";
  }
}

export class BrowserNotOpenError extends BrowserError {
  readonly _tag = "BrowserNotOpenError" as const;
  constructor() {
    super("No browser session is open");
    this.name = "BrowserNotOpenError";
  }
}

export class McpServerStartError extends BrowserError {
  readonly _tag = "McpServerStartError" as const;
  constructor(public readonly cause: string) {
    super(`Failed to start MCP server: ${cause}`);
    this.name = "McpServerStartError";
  }
}

export class ChromeNotFoundError extends BrowserError {
  readonly _tag = "ChromeNotFoundError" as const;
  constructor() {
    super(
      "No system Chrome installation found. Install Google Chrome or pass an explicit executable path.",
    );
    this.name = "ChromeNotFoundError";
  }
}

export class ChromeSpawnError extends BrowserError {
  readonly _tag = "ChromeSpawnError" as const;
  constructor(public readonly cause: string) {
    super(`Failed to spawn Chrome process: ${cause}`);
    this.name = "ChromeSpawnError";
  }
}

export class ChromeLaunchTimeoutError extends BrowserError {
  readonly _tag = "ChromeLaunchTimeoutError" as const;
  constructor(
    public readonly timeoutMs: number,
    public readonly cause: string,
  ) {
    super(`Chrome launch failed (timeout ${timeoutMs}ms): ${cause}`);
    this.name = "ChromeLaunchTimeoutError";
  }
}

export class ChromeProfileNotFoundError extends BrowserError {
  readonly _tag = "ChromeProfileNotFoundError" as const;
  constructor(public readonly profileName: string) {
    super(`Chrome profile "${profileName}" not found.`);
    this.name = "ChromeProfileNotFoundError";
  }
}

export type ActionError =
  | RefAmbiguousError
  | RefBlockedError
  | RefNotVisibleError
  | ActionTimeoutError
  | ActionUnknownError;
