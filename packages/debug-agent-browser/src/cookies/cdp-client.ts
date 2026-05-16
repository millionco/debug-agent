import { spawn, type ChildProcess } from "node:child_process";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import WebSocket from "ws";
import getPort from "get-port";
import { z } from "zod";
import {
  CdpInvalidResponsePayload,
  DebuggerUrlNotFoundError,
  ExtractionError,
  UnknownError,
} from "./errors";
import { Cookie, cookieInputSchema } from "./types";
import { defaultLogger, type Logger } from "./logger";
import {
  CDP_COOKIE_READ_TIMEOUT_MS,
  CDP_RETRY_BACKOFF_CAP_EXPONENT,
  CDP_RETRY_BASE_DELAY_MS,
  CDP_RETRY_COUNT,
  HEADLESS_CHROME_ARGS,
} from "./constants";

const cdpCookieResponseSchema = z.object({
  id: z.number(),
  error: z
    .object({
      code: z.number(),
      message: z.string(),
    })
    .optional(),
  result: z
    .object({
      cookies: z.array(cookieInputSchema),
    })
    .optional(),
});

const cdpTargetSchema = z.array(
  z.object({
    type: z.string(),
    webSocketDebuggerUrl: z.string().optional(),
  }),
);

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

const cleanupStaleCdpDirs = async (logger: Logger): Promise<void> => {
  const tempBasePath = os.tmpdir();
  let entries: string[];
  try {
    entries = await fs.readdir(tempBasePath);
  } catch {
    return;
  }
  const staleDirs = entries.filter((entry) => entry.startsWith("cookies-cdp-"));
  if (staleDirs.length === 0) return;

  logger.info("Cleaning up stale CDP temp directories", { count: staleDirs.length });
  await Promise.all(
    staleDirs.map((entry) =>
      fs.rm(path.join(tempBasePath, entry), { recursive: true, force: true }).catch(() => {}),
    ),
  );
};

const findDebuggerUrl = async (port: number): Promise<string> => {
  let lastError: unknown;
  for (let attempt = 0; attempt < CDP_RETRY_COUNT; attempt++) {
    try {
      const response = await fetch(`http://localhost:${port}/json`);
      if (!response.ok) throw new Error(`status ${response.status}`);
      const targets = cdpTargetSchema.parse(await response.json());
      const pageTarget = targets.find((target) => target.type === "page");
      if (pageTarget?.webSocketDebuggerUrl) return pageTarget.webSocketDebuggerUrl;
    } catch (cause) {
      lastError = cause;
    }
    const backoff =
      CDP_RETRY_BASE_DELAY_MS * 2 ** Math.min(attempt, CDP_RETRY_BACKOFF_CAP_EXPONENT);
    await sleep(backoff);
  }
  throw new ExtractionError(
    new UnknownError(
      lastError instanceof Error
        ? `CDP debugger URL not found after ${CDP_RETRY_COUNT} attempts: ${lastError.message}`
        : new DebuggerUrlNotFoundError(),
    ),
  );
};

const getAllCookies = (debuggerUrl: string): Promise<Cookie[]> =>
  new Promise((resolve, reject) => {
    const socket = new WebSocket(debuggerUrl);
    const timer = setTimeout(() => {
      socket.close();
      reject(new ExtractionError(new UnknownError(new Error("CDP cookie read timed out"))));
    }, CDP_COOKIE_READ_TIMEOUT_MS);

    socket.once("open", () => {
      socket.send(JSON.stringify({ id: 1, method: "Network.getAllCookies" }));
    });

    socket.on("message", (raw) => {
      try {
        const decoded = cdpCookieResponseSchema.parse(JSON.parse(raw.toString()));
        if (decoded.error) {
          clearTimeout(timer);
          socket.close();
          reject(
            new ExtractionError(
              new CdpInvalidResponsePayload(decoded.error.code, decoded.error.message),
            ),
          );
          return;
        }
        if (decoded.result) {
          clearTimeout(timer);
          socket.close();
          resolve(decoded.result.cookies.map((cookie) => new Cookie(cookie)));
        }
      } catch (cause) {
        clearTimeout(timer);
        socket.close();
        reject(new ExtractionError(new UnknownError(cause)));
      }
    });

    socket.once("error", (cause) => {
      clearTimeout(timer);
      reject(new ExtractionError(new UnknownError(cause)));
    });
  });

const waitForExit = (child: ChildProcess) =>
  new Promise<void>((resolve) => {
    if (child.exitCode !== null || child.signalCode !== null) {
      resolve();
      return;
    }
    child.once("exit", () => resolve());
  });

export interface ExtractCookiesParams {
  key: string;
  profilePath: string;
  executablePath: string;
}

export class CdpClient {
  private readonly cleanupPromise: Promise<void>;

  constructor(private readonly logger: Logger = defaultLogger) {
    this.cleanupPromise = cleanupStaleCdpDirs(logger);
  }

  async extractCookies({
    key,
    profilePath,
    executablePath,
  }: ExtractCookiesParams): Promise<Cookie[]> {
    await this.cleanupPromise;

    let port: number;
    try {
      port = await getPort();
    } catch (cause) {
      throw new ExtractionError(new UnknownError(String(cause)));
    }

    const tempUserDataDirPath = await fs.mkdtemp(path.join(os.tmpdir(), "cookies-cdp-"));
    let chromeProcess: ChildProcess | undefined;

    try {
      const profileDirectoryName = path.basename(profilePath);
      const tempProfilePath = path.join(tempUserDataDirPath, profileDirectoryName);

      await fs.cp(profilePath, tempProfilePath, { recursive: true });

      const localStatePath = path.join(path.dirname(profilePath), "Local State");
      try {
        await fs.access(localStatePath);
        await fs.copyFile(localStatePath, path.join(tempUserDataDirPath, "Local State"));
      } catch {}

      await fs.writeFile(path.join(tempUserDataDirPath, "First Run"), new Uint8Array(0));

      const chromeArgs = [
        `--remote-debugging-port=${port}`,
        ...(key === "dia" ? [] : [`--user-data-dir=${tempUserDataDirPath}`]),
        `--profile-directory=${profileDirectoryName}`,
        ...HEADLESS_CHROME_ARGS,
      ];

      chromeProcess = spawn(executablePath, chromeArgs, {
        stdio: ["ignore", "ignore", "pipe"],
      });

      const debuggerUrl = await findDebuggerUrl(port);
      const cookies = await getAllCookies(debuggerUrl);

      this.logger.info("CDP cookies extracted", {
        profile: profilePath,
        count: cookies.length,
      });

      return cookies;
    } catch (cause) {
      if (cause instanceof ExtractionError) throw cause;
      throw new ExtractionError(new UnknownError(cause));
    } finally {
      if (chromeProcess) {
        chromeProcess.kill();
        await waitForExit(chromeProcess);
      }
      await fs.rm(tempUserDataDirPath, { recursive: true, force: true }).catch(() => {});
    }
  }
}
