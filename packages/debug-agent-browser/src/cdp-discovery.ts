import * as fs from "node:fs/promises";
import net from "node:net";
import * as os from "node:os";
import * as path from "node:path";
import { CDP_COMMON_PORTS, CDP_DISCOVERY_TIMEOUT_MS, CDP_PORT_PROBE_TIMEOUT_MS } from "./constants";
import { CdpDiscoveryError } from "./errors";
import { parseDevToolsActivePort } from "./utils/parse-devtools-active-port";
import { defaultLogger, type Logger } from "./logger";

interface VersionInfo {
  readonly webSocketDebuggerUrl?: string;
}

interface CdpTarget {
  readonly type?: string;
  readonly webSocketDebuggerUrl?: string;
}

const fetchJson = async <A>(url: string): Promise<A> => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), CDP_DISCOVERY_TIMEOUT_MS);
  try {
    const response = await fetch(url, { signal: controller.signal });
    return (await response.json()) as A;
  } catch (cause) {
    throw new CdpDiscoveryError(`Failed to fetch ${url}: ${String(cause)}`);
  } finally {
    clearTimeout(timer);
  }
};

const rewriteWsHost = (wsUrl: string, host: string, port: number): string => {
  try {
    const parsed = new URL(wsUrl);
    parsed.hostname = host;
    parsed.port = String(port);
    return parsed.toString();
  } catch {
    return wsUrl;
  }
};

const discoverViaJsonVersion = async (host: string, port: number): Promise<string> => {
  const info = await fetchJson<VersionInfo>(`http://${host}:${port}/json/version`);
  if (!info.webSocketDebuggerUrl) {
    throw new CdpDiscoveryError(`No webSocketDebuggerUrl in /json/version at ${host}:${port}`);
  }
  return rewriteWsHost(info.webSocketDebuggerUrl, host, port);
};

const discoverViaJsonList = async (host: string, port: number): Promise<string> => {
  const targets = await fetchJson<CdpTarget[]>(`http://${host}:${port}/json/list`);
  const browserTarget = targets.find((target) => target.type === "browser");
  const target = browserTarget ?? targets[0];
  const wsUrl = target?.webSocketDebuggerUrl;
  if (!wsUrl) {
    throw new CdpDiscoveryError(`No webSocketDebuggerUrl found in /json/list at ${host}:${port}`);
  }
  return rewriteWsHost(wsUrl, host, port);
};

const isPortReachable = (host: string, port: number): Promise<boolean> =>
  new Promise<boolean>((resolve) => {
    const socket = new net.Socket();
    socket.setTimeout(CDP_PORT_PROBE_TIMEOUT_MS);
    socket.once("connect", () => {
      socket.destroy();
      resolve(true);
    });
    socket.once("timeout", () => {
      socket.destroy();
      resolve(false);
    });
    socket.once("error", () => {
      socket.destroy();
      resolve(false);
    });
    socket.connect(port, host);
  });

const tryDiscover = async <A>(promise: Promise<A>): Promise<A | undefined> => {
  try {
    return await promise;
  } catch (cause) {
    if (cause instanceof CdpDiscoveryError) return undefined;
    throw cause;
  }
};

export const discoverCdpUrl = async (host: string, port: number): Promise<string> => {
  const versionResult = await tryDiscover(discoverViaJsonVersion(host, port));
  if (versionResult !== undefined) return versionResult;

  const listResult = await tryDiscover(discoverViaJsonList(host, port));
  if (listResult !== undefined) return listResult;

  throw new CdpDiscoveryError(`All CDP discovery methods failed for ${host}:${port}`);
};

const getChromeUserDataDirs = (): string[] => {
  const home = os.homedir();
  const platform = os.platform();

  if (platform === "darwin") {
    const base = path.join(home, "Library", "Application Support");
    return [
      path.join(base, "Google", "Chrome"),
      path.join(base, "Google", "Chrome Canary"),
      path.join(base, "Chromium"),
      path.join(base, "BraveSoftware", "Brave-Browser"),
      path.join(base, "Microsoft Edge"),
      path.join(base, "Arc", "User Data"),
      path.join(base, "net.imput.helium"),
    ];
  }

  if (platform === "linux") {
    const config = path.join(home, ".config");
    return [
      path.join(config, "google-chrome"),
      path.join(config, "google-chrome-unstable"),
      path.join(config, "chromium"),
      path.join(config, "BraveSoftware", "Brave-Browser"),
      path.join(config, "microsoft-edge"),
    ];
  }

  if (platform === "win32") {
    const localAppData = process.env["LOCALAPPDATA"];
    if (!localAppData) return [];
    return [
      path.join(localAppData, "Google", "Chrome", "User Data"),
      path.join(localAppData, "Google", "Chrome SxS", "User Data"),
      path.join(localAppData, "Chromium", "User Data"),
      path.join(localAppData, "BraveSoftware", "Brave-Browser", "User Data"),
      path.join(localAppData, "Microsoft", "Edge", "User Data"),
    ];
  }

  return [];
};

const readDevToolsActivePort = async (
  userDataDir: string,
): Promise<{ port: number; wsPath: string }> => {
  let content: string;
  try {
    content = await fs.readFile(path.join(userDataDir, "DevToolsActivePort"), "utf-8");
  } catch {
    throw new CdpDiscoveryError(`No DevToolsActivePort file in ${userDataDir}`);
  }
  const parsed = parseDevToolsActivePort(content);
  if (!parsed) throw new CdpDiscoveryError(`Invalid DevToolsActivePort in ${userDataDir}`);
  return parsed;
};

export const autoDiscoverCdp = async (logger: Logger = defaultLogger): Promise<string> => {
  const userDataDirs = getChromeUserDataDirs();

  for (const dir of userDataDirs) {
    const portResult = await tryDiscover(readDevToolsActivePort(dir));
    if (!portResult) continue;

    const { port, wsPath } = portResult;
    logger.debug("Found DevToolsActivePort", { dir, port });
    const reachable = await isPortReachable("127.0.0.1", port);
    if (!reachable) {
      logger.info("Removing stale DevToolsActivePort", { dir, port });
      await fs.unlink(path.join(dir, "DevToolsActivePort")).catch(() => {});
      continue;
    }

    const discovered = await tryDiscover(discoverCdpUrl("127.0.0.1", port));
    if (discovered !== undefined) return discovered;

    return `ws://127.0.0.1:${port}${wsPath}`;
  }

  for (const port of CDP_COMMON_PORTS) {
    const reachable = await isPortReachable("127.0.0.1", port);
    if (!reachable) continue;

    logger.debug("Probing common CDP port", { port });
    const discovered = await tryDiscover(discoverCdpUrl("127.0.0.1", port));
    if (discovered !== undefined) return discovered;
  }

  throw new CdpDiscoveryError(
    "No running Chrome instance found. Launch Chrome with --remote-debugging-port or pass a CDP URL directly.",
  );
};
