import { describe, expect, it, vi } from "vite-plus/test";
import { Browsers } from "../../src/cookies/browser-detector";
import { silentLogger } from "../../src/logger";
import {
  makeChromiumBrowser,
  makeFirefoxBrowser,
  makeSafariBrowser,
} from "../../src/cookies/types";
import { ListBrowsersError } from "../../src/cookies/errors";

describe("Browsers.list", () => {
  it("returns empty list when no sources are registered", async () => {
    const browsers = new Browsers(silentLogger);
    expect(await browsers.list()).toEqual([]);
  });

  it("flattens results from multiple sources", async () => {
    const browsers = new Browsers(silentLogger);
    browsers.register(async () => [
      makeChromiumBrowser({
        key: "chrome",
        profileName: "Default",
        profilePath: "/p",
        executablePath: "/c",
      }),
    ]);
    browsers.register(async () => [
      makeFirefoxBrowser({ profileName: "default-release", profilePath: "/ff" }),
    ]);
    browsers.register(async () => [makeSafariBrowser({})]);

    const list = await browsers.list();
    expect(list).toHaveLength(3);
    expect(list.map((entry) => entry._tag).sort()).toEqual([
      "ChromiumBrowser",
      "FirefoxBrowser",
      "SafariBrowser",
    ]);
  });

  it("filters out the chromium 'System Profile' entry", async () => {
    const browsers = new Browsers(silentLogger);
    browsers.register(async () => [
      makeChromiumBrowser({
        key: "chrome",
        profileName: "System Profile",
        profilePath: "/sys",
        executablePath: "/c",
      }),
      makeChromiumBrowser({
        key: "chrome",
        profileName: "Default",
        profilePath: "/p",
        executablePath: "/c",
      }),
    ]);

    const list = await browsers.list();
    expect(list).toHaveLength(1);
    if (list[0]._tag === "ChromiumBrowser") {
      expect(list[0].profileName).toBe("Default");
    }
  });

  it("does not filter Firefox/Safari profiles named 'System Profile'", async () => {
    const browsers = new Browsers(silentLogger);
    browsers.register(async () => [
      makeFirefoxBrowser({ profileName: "System Profile", profilePath: "/ff" }),
    ]);
    expect(await browsers.list()).toHaveLength(1);
  });

  it("runs sources concurrently", async () => {
    const browsers = new Browsers(silentLogger);
    let firstStarted = 0;
    let secondStarted = 0;

    browsers.register(async () => {
      firstStarted = Date.now();
      await new Promise((resolve) => setTimeout(resolve, 30));
      return [];
    });
    browsers.register(async () => {
      secondStarted = Date.now();
      await new Promise((resolve) => setTimeout(resolve, 30));
      return [];
    });

    await browsers.list();
    expect(Math.abs(firstStarted - secondStarted)).toBeLessThan(20);
  });

  it("propagates source errors", async () => {
    const browsers = new Browsers(silentLogger);
    browsers.register(async () => {
      throw new ListBrowsersError("disk read failed");
    });

    await expect(browsers.list()).rejects.toBeInstanceOf(ListBrowsersError);
  });
});

describe("Browsers.defaultBrowser", () => {
  it("returns undefined when default browser detection fails", async () => {
    vi.doMock("default-browser", () => ({
      default: vi.fn(() => Promise.reject(new Error("no default browser"))),
    }));

    const { Browsers: BrowsersFresh } = await import("../../src/cookies/browser-detector");
    const browsers = new BrowsersFresh(silentLogger);
    browsers.register(async () => []);

    expect(await browsers.defaultBrowser()).toBeUndefined();
    vi.doUnmock("default-browser");
  });
});
