import * as os from "node:os";
import { Browsers } from "./browser-detector";
import {
  registerChromiumSource,
  chromiumPlatformDarwin,
  chromiumPlatformLinux,
  createChromiumPlatformWin32,
} from "./chromium";
import {
  registerFirefoxSource,
  firefoxPlatformDarwin,
  firefoxPlatformLinux,
  firefoxPlatformWin32,
} from "./firefox";
import { registerSafariSource, safariPlatformDarwin } from "./safari";
import { defaultLogger, type Logger } from "./logger";

/**
 * Construct a `Browsers` registry pre-populated with all sources appropriate
 * for the current OS. Replaces the Effect `layerLive`.
 */
export const createBrowsers = async (logger: Logger = defaultLogger): Promise<Browsers> => {
  const browsers = new Browsers(logger);
  const platform = os.platform();

  if (platform === "darwin") {
    registerChromiumSource(browsers, chromiumPlatformDarwin);
    registerFirefoxSource(browsers, firefoxPlatformDarwin);
    registerSafariSource(browsers, safariPlatformDarwin);
  } else if (platform === "win32") {
    const chromiumPlatform = await createChromiumPlatformWin32();
    registerChromiumSource(browsers, chromiumPlatform);
    registerFirefoxSource(browsers, firefoxPlatformWin32);
  } else {
    registerChromiumSource(browsers, chromiumPlatformLinux);
    registerFirefoxSource(browsers, firefoxPlatformLinux);
  }

  return browsers;
};
