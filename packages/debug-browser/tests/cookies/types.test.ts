import { describe, expect, it } from "vite-plus/test";
import {
  Cookie,
  cookieInputSchema,
  browserKeyOf,
  makeChromiumBrowser,
  makeFirefoxBrowser,
  makeSafariBrowser,
} from "../../src/cookies/types";

describe("Cookie", () => {
  it("Cookie.make parses a minimal valid cookie", () => {
    const cookie = Cookie.make({
      name: "session",
      value: "abc",
      domain: "example.com",
      path: "/",
      secure: true,
      httpOnly: false,
    });
    expect(cookie).toBeInstanceOf(Cookie);
    expect(cookie.name).toBe("session");
    expect(cookie.domain).toBe("example.com");
  });

  it("Cookie.make strips leading dot from domain", () => {
    const cookie = Cookie.make({
      name: "n",
      value: "v",
      domain: ".example.com",
      path: "/",
      secure: false,
      httpOnly: false,
    });
    expect(cookie.domain).toBe("example.com");
  });

  it("Cookie.make floors expires", () => {
    const cookie = Cookie.make({
      name: "n",
      value: "v",
      domain: "example.com",
      path: "/",
      expires: 1700000000.9,
      secure: false,
      httpOnly: false,
    });
    expect(cookie.expires).toBe(1700000000);
  });

  it("Cookie.make rejects invalid sameSite", () => {
    expect(() =>
      Cookie.make({
        name: "n",
        value: "v",
        domain: "example.com",
        path: "/",
        secure: false,
        httpOnly: false,
        sameSite: "InvalidPolicy",
      }),
    ).toThrow();
  });

  it("Cookie.make rejects missing required fields", () => {
    expect(() =>
      Cookie.make({ name: "n", value: "v", domain: "example.com", path: "/" }),
    ).toThrow();
  });

  it("playwrightFormat uses session expiry when expires is undefined", () => {
    const cookie = Cookie.make({
      name: "n",
      value: "v",
      domain: "example.com",
      path: "/",
      secure: false,
      httpOnly: false,
    });
    expect(cookie.playwrightFormat.expires).toBe(-1);
  });

  it("playwrightFormat preserves __Host- prefix domain without dot", () => {
    const cookie = Cookie.make({
      name: "__Host-csrf",
      value: "v",
      domain: "example.com",
      path: "/",
      secure: true,
      httpOnly: true,
    });
    expect(cookie.playwrightFormat.domain).toBe("example.com");
  });

  it("playwrightFormat adds leading dot for normal cookies", () => {
    const cookie = Cookie.make({
      name: "session",
      value: "v",
      domain: "example.com",
      path: "/",
      secure: false,
      httpOnly: false,
    });
    expect(cookie.playwrightFormat.domain).toBe(".example.com");
  });

  it("cookieInputSchema is exposed for direct parsing", () => {
    const result = cookieInputSchema.safeParse({
      name: "n",
      value: "v",
      domain: "example.com",
      path: "/",
      secure: false,
      httpOnly: false,
    });
    expect(result.success).toBe(true);
  });
});

describe("Browser union helpers", () => {
  it("makeChromiumBrowser tags correctly", () => {
    const browser = makeChromiumBrowser({
      key: "chrome",
      profileName: "Default",
      profilePath: "/tmp/p",
      executablePath: "/tmp/c",
    });
    expect(browser._tag).toBe("ChromiumBrowser");
    expect(browser.key).toBe("chrome");
  });

  it("makeFirefoxBrowser tags correctly", () => {
    const browser = makeFirefoxBrowser({
      profileName: "default-release",
      profilePath: "/tmp/ff",
    });
    expect(browser._tag).toBe("FirefoxBrowser");
  });

  it("makeSafariBrowser tags correctly with no path", () => {
    const browser = makeSafariBrowser({});
    expect(browser._tag).toBe("SafariBrowser");
    expect(browser.cookieFilePath).toBeUndefined();
  });

  it("browserKeyOf returns chromium key for chromium browser", () => {
    const browser = makeChromiumBrowser({
      key: "brave",
      profileName: "Default",
      profilePath: "/tmp/p",
      executablePath: "/tmp/c",
    });
    expect(browserKeyOf(browser)).toBe("brave");
  });

  it("browserKeyOf returns 'firefox' for firefox browser", () => {
    const browser = makeFirefoxBrowser({ profileName: "default", profilePath: "/tmp" });
    expect(browserKeyOf(browser)).toBe("firefox");
  });

  it("browserKeyOf returns 'safari' for safari browser", () => {
    const browser = makeSafariBrowser({});
    expect(browserKeyOf(browser)).toBe("safari");
  });
});
