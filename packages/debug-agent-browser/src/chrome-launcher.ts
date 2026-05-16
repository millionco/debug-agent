import { spawn, type ChildProcess } from "node:child_process";
import * as fs from "node:fs";
import * as fsp from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import which from "which";
import {
  CDP_LAUNCH_TIMEOUT_MS,
  CDP_POLL_INTERVAL_MS,
  HEADLESS_CHROME_WINDOW_HEIGHT_PX,
  HEADLESS_CHROME_WINDOW_WIDTH_PX,
} from "./constants";
import { ChromeNotFoundError, ChromeSpawnError, ChromeLaunchTimeoutError } from "./errors";
import { parseDevToolsActivePort } from "./utils/parse-devtools-active-port";
import { defaultLogger, type Logger } from "./logger";

export interface ChromeProcess {
  readonly process: ChildProcess;
  readonly wsUrl: string;
  readonly userDataDir: string;
  readonly tempUserDataDir: string | undefined;
}

const SYSTEM_CHROME_PATHS_DARWIN = [
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary",
  "/Applications/Chromium.app/Contents/MacOS/Chromium",
  "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser",
  "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
  "/Applications/Arc.app/Contents/MacOS/Arc",
  "/Applications/Helium.app/Contents/MacOS/Helium",
] as const;

const SYSTEM_CHROME_NAMES_LINUX = [
  "google-chrome",
  "google-chrome-stable",
  "chromium-browser",
  "chromium",
  "brave-browser",
  "brave-browser-stable",
  "microsoft-edge",
] as const;

export const findSystemChrome = async (logger: Logger = defaultLogger): Promise<string> => {
  const platform = os.platform();

  if (platform === "darwin") {
    for (const candidate of SYSTEM_CHROME_PATHS_DARWIN) {
      if (fs.existsSync(candidate)) {
        logger.debug("Found system Chrome", { path: candidate });
        return candidate;
      }
    }
  }

  if (platform === "linux") {
    for (const name of SYSTEM_CHROME_NAMES_LINUX) {
      const resolved = which.sync(name, { nothrow: true });
      if (resolved) {
        logger.debug("Found system Chrome", { path: resolved });
        return resolved;
      }
    }
  }

  if (platform === "win32") {
    const localAppData = process.env["LOCALAPPDATA"];
    const programFiles = process.env["PROGRAMFILES"];
    const programFilesX86 = process.env["PROGRAMFILES(X86)"];

    const candidates = [
      localAppData && path.join(localAppData, "Google", "Chrome", "Application", "chrome.exe"),
      localAppData &&
        path.join(localAppData, "BraveSoftware", "Brave-Browser", "Application", "brave.exe"),
      localAppData && path.join(localAppData, "Microsoft", "Edge", "Application", "msedge.exe"),
      programFiles && path.join(programFiles, "Google", "Chrome", "Application", "chrome.exe"),
      programFilesX86 &&
        path.join(programFilesX86, "Google", "Chrome", "Application", "chrome.exe"),
      programFiles && path.join(programFiles, "Microsoft", "Edge", "Application", "msedge.exe"),
      programFilesX86 &&
        path.join(programFilesX86, "Microsoft", "Edge", "Application", "msedge.exe"),
    ].filter((candidate): candidate is string => typeof candidate === "string");

    for (const candidate of candidates) {
      if (fs.existsSync(candidate)) {
        logger.debug("Found system Chrome", { path: candidate });
        return candidate;
      }
    }
  }

  throw new ChromeNotFoundError();
};

const readDevToolsActivePort = (userDataDir: string) => {
  const filePath = path.join(userDataDir, "DevToolsActivePort");
  try {
    return parseDevToolsActivePort(fs.readFileSync(filePath, "utf-8"));
  } catch {
    return undefined;
  }
};

const isContainerEnvironment = (): boolean => {
  if (process.env["CI"]) return true;
  if (os.platform() !== "linux") return false;
  if (process.getuid?.() === 0) return true;
  if (fs.existsSync("/.dockerenv")) return true;
  if (fs.existsSync("/run/.containerenv")) return true;
  try {
    const cgroup = fs.readFileSync("/proc/1/cgroup", "utf-8");
    return cgroup.includes("docker") || cgroup.includes("kubepods") || cgroup.includes("lxc");
  } catch {
    return false;
  }
};

const buildLaunchArgs = (options: {
  headless: boolean;
  userDataDir: string;
  profileDirectory?: string;
}): string[] => {
  const args = [
    "--remote-debugging-port=0",
    "--no-first-run",
    "--no-default-browser-check",
    "--disable-background-networking",
    "--disable-backgrounding-occluded-windows",
    "--disable-component-update",
    "--disable-default-apps",
    "--disable-hang-monitor",
    "--disable-popup-blocking",
    "--disable-prompt-on-repost",
    "--disable-sync",
    "--disable-features=Translate",
    "--enable-features=NetworkService,NetworkServiceInProcess",
    "--metrics-recording-only",
    "--password-store=basic",
    "--use-mock-keychain",
    `--user-data-dir=${options.userDataDir}`,
  ];

  if (options.profileDirectory) {
    args.push(`--profile-directory=${options.profileDirectory}`);
  }

  if (options.headless) {
    args.push(
      "--headless=new",
      "--enable-unsafe-swiftshader",
      `--window-size=${HEADLESS_CHROME_WINDOW_WIDTH_PX},${HEADLESS_CHROME_WINDOW_HEIGHT_PX}`,
    );
  }

  if (isContainerEnvironment()) {
    args.push("--no-sandbox", "--disable-dev-shm-usage");
  }

  return args;
};

const cleanupFailedLaunch = async (
  child: ChildProcess,
  tempDir: string | undefined,
  logger: Logger,
): Promise<void> => {
  try {
    child.kill();
  } catch (cause) {
    logger.debug("Failed to kill Chrome process during cleanup", { cause: String(cause) });
  }
  if (tempDir) {
    await fsp.rm(tempDir, { recursive: true, force: true }).catch((cause) => {
      logger.debug("Failed to remove temp dir during cleanup", { cause: String(cause) });
    });
  }
};

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export interface LaunchSystemChromeOptions {
  headless: boolean;
  profilePath?: string;
  profileDirectory?: string;
  logger?: Logger;
}

export const launchSystemChrome = async (
  options: LaunchSystemChromeOptions,
): Promise<ChromeProcess> => {
  const logger = options.logger ?? defaultLogger;
  const chromePath = await findSystemChrome(logger);

  let tempDir: string | undefined;
  if (!options.profilePath) {
    tempDir = await fsp.mkdtemp(path.join(os.tmpdir(), "expect-chrome-"));
  }

  const userDataDir = options.profilePath ?? tempDir!;

  await fsp
    .rm(path.join(userDataDir, "DevToolsActivePort"), { force: true })
    .catch((cause) =>
      logger.debug("Failed to remove stale DevToolsActivePort", { cause: String(cause) }),
    );

  const args = buildLaunchArgs({
    headless: options.headless,
    userDataDir,
    profileDirectory: options.profileDirectory,
  });

  logger.info("Launching system Chrome", { chromePath, userDataDir });

  let child: ChildProcess;
  try {
    child = spawn(chromePath, args, {
      stdio: ["ignore", "ignore", "pipe"],
      detached: false,
    });
  } catch (cause) {
    throw new ChromeSpawnError(cause instanceof Error ? cause.message : String(cause));
  }

  const wsUrl = await new Promise<string>((resolve, reject) => {
    const deadline = Date.now() + CDP_LAUNCH_TIMEOUT_MS;
    let settled = false;

    const settle = (resolveFn: () => void) => {
      if (settled) return;
      settled = true;
      child.removeListener("error", onSpawnError);
      resolveFn();
    };

    const onSpawnError = (error: Error) => {
      settle(() =>
        reject(
          new ChromeLaunchTimeoutError(
            CDP_LAUNCH_TIMEOUT_MS,
            `Chrome process error: ${error.message}`,
          ),
        ),
      );
    };

    child.on("error", onSpawnError);

    const poll = async () => {
      while (!settled) {
        if (Date.now() > deadline) {
          settle(() =>
            reject(
              new ChromeLaunchTimeoutError(
                CDP_LAUNCH_TIMEOUT_MS,
                "Timed out waiting for DevToolsActivePort",
              ),
            ),
          );
          return;
        }

        const result = readDevToolsActivePort(userDataDir);
        if (result) {
          settle(() => resolve(`ws://127.0.0.1:${result.port}${result.wsPath}`));
          return;
        }

        if (child.exitCode !== null) {
          settle(() =>
            reject(
              new ChromeLaunchTimeoutError(
                CDP_LAUNCH_TIMEOUT_MS,
                `Chrome exited with code ${child.exitCode} before providing CDP URL`,
              ),
            ),
          );
          return;
        }

        await sleep(CDP_POLL_INTERVAL_MS);
      }
    };

    void poll();
  }).catch(async (cause) => {
    await cleanupFailedLaunch(child, tempDir, logger);
    throw cause;
  });

  logger.info("System Chrome launched, CDP available", { wsUrl });

  return {
    process: child,
    wsUrl,
    userDataDir,
    tempUserDataDir: tempDir,
  };
};

export const killChromeProcess = async (
  chrome: ChromeProcess,
  logger: Logger = defaultLogger,
): Promise<void> => {
  try {
    chrome.process.kill();
  } catch (cause) {
    logger.debug("Failed to kill Chrome process", { cause: String(cause) });
  }
  if (chrome.tempUserDataDir) {
    await fsp.rm(chrome.tempUserDataDir, { recursive: true, force: true }).catch((cause) => {
      logger.debug("Failed to remove temp user data dir", { cause: String(cause) });
    });
  }
};
