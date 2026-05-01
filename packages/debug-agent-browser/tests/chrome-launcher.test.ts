import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import type { ChildProcess } from "node:child_process";

const { platformMock, existsSyncMock, rmMock, whichSyncMock } = vi.hoisted(() => ({
  platformMock: vi.fn(),
  existsSyncMock: vi.fn(),
  rmMock: vi.fn(async () => undefined),
  whichSyncMock: vi.fn(),
}));

vi.mock("node:os", async (importOriginal) => {
  const original = await importOriginal<typeof import("node:os")>();
  return { ...original, platform: platformMock };
});

vi.mock("node:fs", async (importOriginal) => {
  const original = await importOriginal<typeof import("node:fs")>();
  return { ...original, existsSync: existsSyncMock };
});

vi.mock("node:fs/promises", async (importOriginal) => {
  const original = await importOriginal<typeof import("node:fs/promises")>();
  return { ...original, rm: rmMock };
});

vi.mock("which", () => ({
  default: { sync: whichSyncMock },
}));

import { findSystemChrome, killChromeProcess } from "../src/chrome-launcher";
import { ChromeNotFoundError } from "../src/errors";

describe("findSystemChrome", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    existsSyncMock.mockReturnValue(false);
    whichSyncMock.mockReturnValue(null);
    rmMock.mockResolvedValue(undefined);
  });

  it("finds Google Chrome on macOS", async () => {
    platformMock.mockReturnValue("darwin");
    existsSyncMock.mockImplementation(
      (filePath: string) =>
        filePath === "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    );

    const result = await findSystemChrome();

    expect(result).toBe("/Applications/Google Chrome.app/Contents/MacOS/Google Chrome");
  });

  it("returns first available browser on macOS", async () => {
    platformMock.mockReturnValue("darwin");
    existsSyncMock.mockImplementation(
      (filePath: string) =>
        filePath === "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser",
    );

    const result = await findSystemChrome();

    expect(result).toBe("/Applications/Brave Browser.app/Contents/MacOS/Brave Browser");
  });

  it("finds Chrome on Linux via which", async () => {
    platformMock.mockReturnValue("linux");
    whichSyncMock.mockImplementation((name: string) =>
      name === "google-chrome" ? "/usr/bin/google-chrome" : null,
    );

    const result = await findSystemChrome();

    expect(result).toBe("/usr/bin/google-chrome");
    expect(whichSyncMock).toHaveBeenCalledWith("google-chrome", { nothrow: true });
  });

  it("tries candidates in priority order on Linux", async () => {
    platformMock.mockReturnValue("linux");
    whichSyncMock.mockImplementation((name: string) =>
      name === "chromium" ? "/usr/bin/chromium" : null,
    );

    const result = await findSystemChrome();

    expect(result).toBe("/usr/bin/chromium");
    expect(whichSyncMock).toHaveBeenNthCalledWith(1, "google-chrome", { nothrow: true });
    expect(whichSyncMock).toHaveBeenNthCalledWith(2, "google-chrome-stable", { nothrow: true });
    expect(whichSyncMock).toHaveBeenNthCalledWith(3, "chromium-browser", { nothrow: true });
    expect(whichSyncMock).toHaveBeenNthCalledWith(4, "chromium", { nothrow: true });
  });

  it("fails with ChromeNotFoundError when no browser is found on macOS", async () => {
    platformMock.mockReturnValue("darwin");

    await expect(findSystemChrome()).rejects.toBeInstanceOf(ChromeNotFoundError);
  });

  it("fails with ChromeNotFoundError when no browser is found on Linux", async () => {
    platformMock.mockReturnValue("linux");

    await expect(findSystemChrome()).rejects.toBeInstanceOf(ChromeNotFoundError);
  });

  it("fails with ChromeNotFoundError on unsupported platform", async () => {
    platformMock.mockReturnValue("freebsd");

    await expect(findSystemChrome()).rejects.toBeInstanceOf(ChromeNotFoundError);
  });
});

describe("killChromeProcess", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    rmMock.mockResolvedValue(undefined);
  });

  it("kills process and removes temp dir", async () => {
    const killMock = vi.fn(() => true);
    const chrome = {
      process: { kill: killMock } as unknown as ChildProcess,
      wsUrl: "ws://127.0.0.1:9222/devtools/browser/abc",
      userDataDir: "/tmp/expect-chrome-abc123",
      tempUserDataDir: "/tmp/expect-chrome-abc123",
    };

    await killChromeProcess(chrome);

    expect(killMock).toHaveBeenCalledOnce();
    expect(rmMock).toHaveBeenCalledWith("/tmp/expect-chrome-abc123", {
      recursive: true,
      force: true,
    });
  });

  it("skips temp dir removal when no temp dir exists", async () => {
    const killMock = vi.fn(() => true);
    const chrome = {
      process: { kill: killMock } as unknown as ChildProcess,
      wsUrl: "ws://127.0.0.1:9222/devtools/browser/abc",
      userDataDir: "/home/user/.config/google-chrome",
      tempUserDataDir: undefined,
    };

    await killChromeProcess(chrome);

    expect(killMock).toHaveBeenCalledOnce();
    expect(rmMock).not.toHaveBeenCalled();
  });

  it("continues gracefully when process.kill throws", async () => {
    const killMock = vi.fn(() => {
      throw new Error("No such process");
    });
    const chrome = {
      process: { kill: killMock } as unknown as ChildProcess,
      wsUrl: "ws://127.0.0.1:9222/devtools/browser/abc",
      userDataDir: "/tmp/expect-chrome-abc123",
      tempUserDataDir: "/tmp/expect-chrome-abc123",
    };

    await killChromeProcess(chrome);

    expect(killMock).toHaveBeenCalledOnce();
    expect(rmMock).toHaveBeenCalledOnce();
  });

  it("continues gracefully when rm throws", async () => {
    const killMock = vi.fn(() => true);
    rmMock.mockRejectedValue(new Error("EPERM"));
    const chrome = {
      process: { kill: killMock } as unknown as ChildProcess,
      wsUrl: "ws://127.0.0.1:9222/devtools/browser/abc",
      userDataDir: "/tmp/expect-chrome-abc123",
      tempUserDataDir: "/tmp/expect-chrome-abc123",
    };

    await killChromeProcess(chrome);

    expect(killMock).toHaveBeenCalledOnce();
    expect(rmMock).toHaveBeenCalledOnce();
  });
});
