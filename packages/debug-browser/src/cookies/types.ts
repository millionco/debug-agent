import { z } from "zod";

export const sameSitePolicySchema = z.enum(["Strict", "Lax", "None"]);
export type SameSitePolicy = z.infer<typeof sameSitePolicySchema>;

export const browserKeySchema = z.enum([
  "chrome",
  "edge",
  "brave",
  "arc",
  "dia",
  "helium",
  "chromium",
  "vivaldi",
  "opera",
  "ghost",
  "sidekick",
  "yandex",
  "iridium",
  "thorium",
  "sigmaos",
  "wavebox",
  "comet",
  "blisk",
  "firefox",
  "safari",
]);
export type BrowserKey = z.infer<typeof browserKeySchema>;

export const chromiumBrowserKeySchema = z.enum([
  "chrome",
  "edge",
  "brave",
  "arc",
  "dia",
  "helium",
  "chromium",
  "vivaldi",
  "opera",
  "ghost",
  "sidekick",
  "yandex",
  "iridium",
  "thorium",
  "sigmaos",
  "wavebox",
  "comet",
  "blisk",
]);
export type ChromiumBrowserKey = z.infer<typeof chromiumBrowserKeySchema>;

export const cookieInputSchema = z.object({
  name: z.string(),
  value: z.string(),
  domain: z.string().transform((domain) => (domain.startsWith(".") ? domain.slice(1) : domain)),
  path: z.string(),
  expires: z
    .number()
    .transform((value) => Math.floor(value))
    .optional(),
  secure: z.boolean(),
  httpOnly: z.boolean(),
  sameSite: sameSitePolicySchema.optional(),
});

export type CookieData = z.infer<typeof cookieInputSchema>;

export class Cookie implements CookieData {
  readonly name: string;
  readonly value: string;
  readonly domain: string;
  readonly path: string;
  readonly expires?: number;
  readonly secure: boolean;
  readonly httpOnly: boolean;
  readonly sameSite?: SameSitePolicy;

  constructor(data: CookieData) {
    this.name = data.name;
    this.value = data.value;
    this.domain = data.domain;
    this.path = data.path;
    this.expires = data.expires;
    this.secure = data.secure;
    this.httpOnly = data.httpOnly;
    this.sameSite = data.sameSite;
  }

  static make(input: unknown): Cookie {
    return new Cookie(cookieInputSchema.parse(input));
  }

  get playwrightFormat() {
    const SESSION_EXPIRES = -1;
    const domain = this.name.startsWith("__Host-")
      ? this.domain
      : this.domain.startsWith(".")
        ? this.domain
        : `.${this.domain}`;

    return {
      name: this.name,
      value: this.value,
      domain,
      path: this.path,
      expires: this.expires ?? SESSION_EXPIRES,
      secure: this.secure,
      httpOnly: this.httpOnly,
      sameSite: this.sameSite,
    };
  }
}

export interface ChromiumBrowser {
  readonly _tag: "ChromiumBrowser";
  readonly key: ChromiumBrowserKey;
  readonly profileName: string;
  readonly profilePath: string;
  readonly executablePath: string;
  readonly locale?: string;
}

export const chromiumBrowserOrderBy =
  (lastUsedProfileName: string | undefined) =>
  (left: ChromiumBrowser, right: ChromiumBrowser): number => {
    const leftLast = left.profileName === lastUsedProfileName;
    const rightLast = right.profileName === lastUsedProfileName;
    if (leftLast !== rightLast) return leftLast ? -1 : 1;
    return left.profileName.localeCompare(right.profileName, undefined, { numeric: true });
  };

export interface FirefoxBrowser {
  readonly _tag: "FirefoxBrowser";
  readonly profileName: string;
  readonly profilePath: string;
}

export interface SafariBrowser {
  readonly _tag: "SafariBrowser";
  readonly cookieFilePath?: string;
}

export type Browser = ChromiumBrowser | FirefoxBrowser | SafariBrowser;

export const makeChromiumBrowser = (input: Omit<ChromiumBrowser, "_tag">): ChromiumBrowser => ({
  _tag: "ChromiumBrowser",
  ...input,
});

export const makeFirefoxBrowser = (input: Omit<FirefoxBrowser, "_tag">): FirefoxBrowser => ({
  _tag: "FirefoxBrowser",
  ...input,
});

export const makeSafariBrowser = (input: Omit<SafariBrowser, "_tag">): SafariBrowser => ({
  _tag: "SafariBrowser",
  ...input,
});

export interface ExtractOptions {
  url: string;
  browsers?: BrowserKey[];
  names?: string[];
  includeExpired?: boolean;
}

export const browserKeyOf = (browser: Browser): BrowserKey => {
  if (browser._tag === "ChromiumBrowser") return browser.key;
  if (browser._tag === "FirefoxBrowser") return "firefox";
  return "safari";
};
