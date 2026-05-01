import { describe, expect, it } from "vite-plus/test";
import {
  BrowserError,
  BrowserLaunchError,
  RefNotFoundError,
  RefAmbiguousError,
  RefBlockedError,
  RefNotVisibleError,
  ActionTimeoutError,
  ActionUnknownError,
  CdpDiscoveryError,
  CdpConnectionError,
  ChromeNotFoundError,
  ChromeSpawnError,
  ChromeLaunchTimeoutError,
  NavigationError,
  SnapshotTimeoutError,
} from "../src/errors";
import {
  CookieError,
  ExtractionError,
  RequiresFullDiskAccess,
  ListBrowsersError,
  CookieDatabaseNotFoundError,
  CookieDecryptionKeyError,
  UnknownError,
} from "../src/cookies/errors";

describe("Browser errors", () => {
  it("all extend BrowserError and Error", () => {
    const errors = [
      new BrowserLaunchError("boom"),
      new RefNotFoundError("e1", []),
      new RefAmbiguousError("e1", "3"),
      new RefBlockedError("e1"),
      new RefNotVisibleError("e1"),
      new ActionTimeoutError("e1"),
      new ActionUnknownError("e1", "x"),
      new CdpDiscoveryError("nope"),
      new CdpConnectionError("ws://localhost:0", "x"),
      new ChromeNotFoundError(),
      new ChromeSpawnError("x"),
      new ChromeLaunchTimeoutError(1000, "x"),
      new NavigationError("https://x", "x"),
      new SnapshotTimeoutError("body", 1000, "x"),
    ];
    for (const error of errors) {
      expect(error).toBeInstanceOf(BrowserError);
      expect(error).toBeInstanceOf(Error);
      expect(typeof error._tag).toBe("string");
      expect(error.name).toBe(error._tag);
    }
  });

  it("RefNotFoundError messages distinguish empty vs populated refs", () => {
    expect(new RefNotFoundError("e1", []).message).toContain("page may be empty");
    expect(new RefNotFoundError("e9", ["e1", "e2"]).message).toContain("e1, e2");
  });

  it("_tag discriminator narrows in switch", () => {
    const error: BrowserError = new RefAmbiguousError("e1", "3");
    let count: string | undefined;
    switch (error._tag) {
      case "RefAmbiguousError":
        count = error.matchCount;
        break;
      default:
        count = undefined;
    }
    expect(count).toBe("3");
  });

  it("instanceof check narrows", () => {
    const error: unknown = new SnapshotTimeoutError("body", 5000, "timed out");
    if (error instanceof SnapshotTimeoutError) {
      expect(error.timeoutMs).toBe(5000);
      expect(error.selector).toBe("body");
    } else {
      throw new Error("expected SnapshotTimeoutError");
    }
  });
});

describe("Cookie errors", () => {
  it("all extend CookieError and Error", () => {
    const errors = [
      new ListBrowsersError("x"),
      new CookieDatabaseNotFoundError("chrome"),
      new CookieDecryptionKeyError("chrome", "darwin"),
      new ExtractionError(new RequiresFullDiskAccess()),
      new ExtractionError(new UnknownError(new Error("x"))),
    ];
    for (const error of errors) {
      expect(error).toBeInstanceOf(CookieError);
      expect(error).toBeInstanceOf(Error);
      expect(typeof error._tag).toBe("string");
    }
  });

  it("ExtractionError nests reason and surfaces it in message", () => {
    const reason = new CookieDecryptionKeyError("chrome", "darwin");
    const wrapped = new ExtractionError(new UnknownError(reason));
    expect(wrapped._tag).toBe("ExtractionError");
    expect(wrapped.reason._tag).toBe("UnknownError");
    expect(wrapped.message).toContain("Decryption key not found");
  });

  it("RequiresFullDiskAccess is a usable ExtractionError reason", () => {
    const error = new ExtractionError(new RequiresFullDiskAccess());
    expect(error.reason._tag).toBe("RequiresFullDiskAccess");
    expect(error.message).toContain("Full Disk Access");
  });
});
