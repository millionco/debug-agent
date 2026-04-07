import fs from "node:fs";
import path from "node:path";

export interface ServerLockData {
  pid: number;
  host: string;
  port: number;
  sessionId: string;
  endpoint: string;
  logPath: string;
}

const LOCK_FILENAME = "debug-server.lock";

const getLockPath = (agentsDirectory: string): string => path.join(agentsDirectory, LOCK_FILENAME);

export const readServerLock = (agentsDirectory: string): ServerLockData | null => {
  const lockPath = getLockPath(agentsDirectory);
  if (!fs.existsSync(lockPath)) return null;

  try {
    return JSON.parse(fs.readFileSync(lockPath, "utf-8"));
  } catch {
    return null;
  }
};

export const writeServerLock = (agentsDirectory: string, lockData: ServerLockData): void => {
  fs.writeFileSync(getLockPath(agentsDirectory), JSON.stringify(lockData, null, 2));
};

export const removeServerLock = (agentsDirectory: string): void => {
  const lockPath = getLockPath(agentsDirectory);
  if (fs.existsSync(lockPath)) {
    try {
      fs.unlinkSync(lockPath);
    } catch {}
  }
};
