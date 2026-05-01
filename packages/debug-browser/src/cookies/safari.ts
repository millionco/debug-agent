import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { SAFARI_CONFIG } from "./browser-config";
import { ListBrowsersError } from "./errors";
import { Browsers } from "./browser-detector";
import { makeSafariBrowser } from "./types";

export interface SafariPlatform {
  readonly executable: string;
  readonly cookieRelativePaths: readonly string[];
}

export const safariPlatformDarwin: SafariPlatform = {
  executable: SAFARI_CONFIG.executable,
  cookieRelativePaths: SAFARI_CONFIG.cookieRelativePaths,
};

const exists = async (filePath: string): Promise<boolean> => {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
};

export const registerSafariSource = (browsers: Browsers, platform: SafariPlatform): void => {
  browsers.register(async () => {
    try {
      if (!(await exists(platform.executable))) return [];

      let cookieFilePath: string | undefined;
      for (const relativePath of platform.cookieRelativePaths) {
        const candidate = path.join(os.homedir(), relativePath, "Cookies.binarycookies");
        if (await exists(candidate)) {
          cookieFilePath = candidate;
          break;
        }
      }

      return [makeSafariBrowser({ cookieFilePath })];
    } catch (cause) {
      throw new ListBrowsersError(String(cause));
    }
  });
};
