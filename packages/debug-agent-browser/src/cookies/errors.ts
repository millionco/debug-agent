export type CookieErrorTag =
  | "CookieDatabaseNotFoundError"
  | "CdpInvalidResponsePayload"
  | "DebuggerUrlNotFoundError"
  | "UnknownError"
  | "RequiresFullDiskAccess"
  | "ExtractionError"
  | "CookieDatabaseCopyError"
  | "CookieDecryptionKeyError"
  | "CookieReadError"
  | "CdpConnectionError"
  | "BrowserSpawnError"
  | "UnsupportedPlatformError"
  | "UnsupportedBrowserError"
  | "ListBrowsersError";

export abstract class CookieError extends Error {
  abstract readonly _tag: CookieErrorTag;
}

export class CookieDatabaseNotFoundError extends CookieError {
  readonly _tag = "CookieDatabaseNotFoundError" as const;
  constructor(public readonly browser: string) {
    super(`Cookie database not found for ${browser}`);
    this.name = "CookieDatabaseNotFoundError";
  }
}

export class CdpInvalidResponsePayload extends CookieError {
  readonly _tag = "CdpInvalidResponsePayload" as const;
  constructor(
    public readonly code: number,
    public readonly errorMessage: string,
  ) {
    super(`Network.getAllCookies responded with #${code}: ${errorMessage}`);
    this.name = "CdpInvalidResponsePayload";
  }
}

export class DebuggerUrlNotFoundError extends CookieError {
  readonly _tag = "DebuggerUrlNotFoundError" as const;
  constructor() {
    super("Debugger URL not found");
    this.name = "DebuggerUrlNotFoundError";
  }
}

export class UnknownError extends CookieError {
  readonly _tag = "UnknownError" as const;
  constructor(public readonly cause: unknown) {
    super(`An unexpected error occurred. ${String(cause)}`);
    this.name = "UnknownError";
  }
}

export class RequiresFullDiskAccess extends CookieError {
  readonly _tag = "RequiresFullDiskAccess" as const;
  constructor() {
    super("Safari cookie extraction requires Full Disk Access");
    this.name = "RequiresFullDiskAccess";
  }
}

export type ExtractionReason =
  | CdpInvalidResponsePayload
  | DebuggerUrlNotFoundError
  | RequiresFullDiskAccess
  | UnknownError;

export class ExtractionError extends CookieError {
  readonly _tag = "ExtractionError" as const;
  constructor(public readonly reason: ExtractionReason) {
    super(`Extracting cookies failed. Error: ${reason.message}`);
    this.name = "ExtractionError";
  }
}

export class CookieDatabaseCopyError extends CookieError {
  readonly _tag = "CookieDatabaseCopyError" as const;
  constructor(
    public readonly browser: string,
    public readonly databasePath: string,
    public readonly cause: string,
  ) {
    super(`Failed to copy cookie database for ${browser}: ${cause}`);
    this.name = "CookieDatabaseCopyError";
  }
}

export class CookieDecryptionKeyError extends CookieError {
  readonly _tag = "CookieDecryptionKeyError" as const;
  constructor(
    public readonly browser: string,
    public readonly platform: string,
  ) {
    super(`Decryption key not found for ${browser} on ${platform}`);
    this.name = "CookieDecryptionKeyError";
  }
}

export class CookieReadError extends CookieError {
  readonly _tag = "CookieReadError" as const;
  constructor(
    public readonly browser: string,
    public readonly cause: string,
  ) {
    super(`Failed to read cookies for ${browser}: ${cause}`);
    this.name = "CookieReadError";
  }
}

export class CdpConnectionError extends CookieError {
  readonly _tag = "CdpConnectionError" as const;
  constructor(
    public readonly port: number,
    public readonly cause: string,
  ) {
    super(`CDP connection failed on port ${port}: ${cause}`);
    this.name = "CdpConnectionError";
  }
}

export class BrowserSpawnError extends CookieError {
  readonly _tag = "BrowserSpawnError" as const;
  constructor(
    public readonly executablePath: string,
    public readonly cause: string,
  ) {
    super(`Failed to spawn browser at ${executablePath}: ${cause}`);
    this.name = "BrowserSpawnError";
  }
}

export class UnsupportedPlatformError extends CookieError {
  readonly _tag = "UnsupportedPlatformError" as const;
  constructor(public readonly platform: string) {
    super(`Unsupported platform: ${platform}`);
    this.name = "UnsupportedPlatformError";
  }
}

export class UnsupportedBrowserError extends CookieError {
  readonly _tag = "UnsupportedBrowserError" as const;
  constructor(public readonly browser: string) {
    super(`Unsupported browser: ${browser}`);
    this.name = "UnsupportedBrowserError";
  }
}

export class ListBrowsersError extends CookieError {
  readonly _tag = "ListBrowsersError" as const;
  constructor(public readonly cause: string) {
    super(`Failed to list browsers: ${cause}`);
    this.name = "ListBrowsersError";
  }
}
