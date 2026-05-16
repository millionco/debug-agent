import getDefaultBrowser from "default-browser";
import { configByBundleId, configByDesktopFile } from "./browser-config";
import { ListBrowsersError } from "./errors";
import type { Browser } from "./types";
import type { Logger } from "./logger";
import { defaultLogger } from "./logger";

export type BrowserSource = () => Promise<Browser[]>;

export class Browsers {
  private readonly sources = new Set<BrowserSource>();

  constructor(private readonly logger: Logger = defaultLogger) {}

  register(source: BrowserSource): void {
    this.sources.add(source);
  }

  async list(): Promise<Browser[]> {
    const results = await Promise.all([...this.sources].map((source) => source()));
    return results
      .flat()
      .filter(
        (browser) => browser._tag !== "ChromiumBrowser" || browser.profileName !== "System Profile",
      );
  }

  async defaultBrowser(): Promise<Browser | undefined> {
    let result;
    try {
      result = await getDefaultBrowser();
    } catch (cause) {
      this.logger.warn("Default browser detection failed", { cause: String(cause) });
      return undefined;
    }

    const normalizedId = result.id.toLowerCase();
    const desktopKey = normalizedId.replace(/\.desktop$/, "");
    const config = configByBundleId(normalizedId) ?? configByDesktopFile(desktopKey);
    if (!config) return undefined;

    let browsers: Browser[];
    try {
      browsers = await this.list();
    } catch (cause) {
      if (cause instanceof ListBrowsersError) return undefined;
      throw cause;
    }

    return browsers.find((browser) => {
      if (browser._tag === "ChromiumBrowser") return browser.key === config.key;
      if (browser._tag === "FirefoxBrowser") return config.key === "firefox";
      if (browser._tag === "SafariBrowser") return config.key === "safari";
      return false;
    });
  }
}
