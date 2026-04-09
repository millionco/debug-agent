import http from "node:http";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import { SESSION_ID_BYTE_LENGTH, LOG_DIRECTORY_NAME, MAX_DEDUP_ENTRIES } from "./constants.js";
import { getErrorMessage } from "./utils/get-error-message.js";
import { readServerLock, writeServerLock, removeServerLock } from "./utils/server-lock.js";
import { pingServer } from "./utils/ping-server.js";

export interface ServerOptions {
  sessionId?: string;
  cwd?: string;
  logPath?: string;
  host?: string;
  port?: number;
}

export interface ServerInfo {
  sessionId: string;
  port: number;
  endpoint: string;
  logPath: string;
}

export interface ServerResult {
  server: http.Server | null;
  info: ServerInfo;
  reused: boolean;
}

interface SessionState {
  logPath: string;
  processedEntryIds: Set<string>;
}

const parseIngestPath = (url: string): string | null => {
  try {
    const { pathname } = new URL(url, "http://localhost");
    const match = pathname.match(/^\/ingest\/([a-zA-Z0-9_-]+)\/?$/);
    return match ? match[1] : null;
  } catch {
    return null;
  }
};

export const createServer = async (options: ServerOptions = {}): Promise<ServerResult> => {
  const sessionId = options.sessionId || crypto.randomBytes(SESSION_ID_BYTE_LENGTH).toString("hex");
  const logDirectory = path.join(options.cwd || os.tmpdir(), LOG_DIRECTORY_NAME);
  const primaryLogPath = options.logPath || path.join(logDirectory, `debug-${sessionId}.log`);
  const host = options.host || "127.0.0.1";
  const port = options.port || 0;

  if (!fs.existsSync(logDirectory)) fs.mkdirSync(logDirectory, { recursive: true });

  const existingLock = readServerLock(logDirectory);
  if (existingLock) {
    const isAlive = await pingServer(existingLock.host, existingLock.port);
    if (isAlive) {
      return {
        server: null,
        info: {
          sessionId: existingLock.sessionId,
          port: existingLock.port,
          endpoint: existingLock.endpoint,
          logPath: existingLock.logPath,
        },
        reused: true,
      };
    }
    removeServerLock(logDirectory);
  }

  const sessions = new Map<string, SessionState>();

  const getSessionState = (requestSessionId: string): SessionState => {
    const existing = sessions.get(requestSessionId);
    if (existing) return existing;

    const sessionLogPath =
      requestSessionId === sessionId
        ? primaryLogPath
        : path.join(logDirectory, `debug-${requestSessionId}.log`);
    const state: SessionState = { logPath: sessionLogPath, processedEntryIds: new Set() };
    sessions.set(requestSessionId, state);
    return state;
  };

  const server = http.createServer((request, response) => {
    response.setHeader("Access-Control-Allow-Origin", "*");
    response.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
    response.setHeader("Access-Control-Allow-Headers", "Content-Type");

    if (request.method === "OPTIONS") {
      response.writeHead(204).end();
      return;
    }

    const url = request.url || "/";

    if (url === "/" && request.method === "GET") {
      response.writeHead(200, { "Content-Type": "application/json" });
      response.end(JSON.stringify({ ok: true }));
      return;
    }

    const requestSessionId = parseIngestPath(url);
    if (!requestSessionId) {
      response.writeHead(404, { "Content-Type": "application/json" });
      response.end(JSON.stringify({ error: "Not found" }));
      return;
    }

    const sessionState = getSessionState(requestSessionId);

    if (request.method === "POST") {
      let requestBody = "";
      request.on("data", (chunk: Buffer) => (requestBody += chunk));
      request.on("end", () => {
        try {
          const logEntry = JSON.parse(requestBody);

          if (logEntry.id && sessionState.processedEntryIds.has(logEntry.id)) {
            response.writeHead(200, { "Content-Type": "application/json" });
            response.end(JSON.stringify({ ok: true, duplicate: true }));
            return;
          }

          logEntry.sessionId = logEntry.sessionId || requestSessionId;
          logEntry.timestamp = logEntry.timestamp || Date.now();
          fs.appendFileSync(sessionState.logPath, JSON.stringify(logEntry) + "\n");

          if (logEntry.id) {
            if (sessionState.processedEntryIds.size >= MAX_DEDUP_ENTRIES) {
              sessionState.processedEntryIds.clear();
            }
            sessionState.processedEntryIds.add(logEntry.id);
          }

          response.writeHead(200, { "Content-Type": "application/json" });
          response.end(JSON.stringify({ ok: true }));
        } catch {
          response.writeHead(400, { "Content-Type": "application/json" });
          response.end(JSON.stringify({ error: "Invalid JSON" }));
        }
      });
      return;
    }

    if (request.method === "DELETE") {
      try {
        if (fs.existsSync(sessionState.logPath)) fs.unlinkSync(sessionState.logPath);
        sessionState.processedEntryIds.clear();
        response.writeHead(200, { "Content-Type": "application/json" });
        response.end(JSON.stringify({ ok: true, cleared: true }));
      } catch (error: unknown) {
        response.writeHead(500, { "Content-Type": "application/json" });
        response.end(JSON.stringify({ error: getErrorMessage(error) }));
      }
      return;
    }

    if (request.method === "GET") {
      try {
        const logContent = fs.existsSync(sessionState.logPath)
          ? fs.readFileSync(sessionState.logPath, "utf-8")
          : "";
        response.writeHead(200, { "Content-Type": "application/x-ndjson" });
        response.end(logContent);
      } catch (error: unknown) {
        response.writeHead(500, { "Content-Type": "text/plain" });
        response.end(getErrorMessage(error));
      }
      return;
    }

    response.writeHead(405).end();
  });

  return new Promise<ServerResult>((resolve, reject) => {
    server.listen(port, host, () => {
      const serverAddress = server.address();
      if (!serverAddress || typeof serverAddress === "string") {
        reject(new Error("Failed to get server address"));
        return;
      }

      const info: ServerInfo = {
        sessionId,
        port: serverAddress.port,
        endpoint: `http://${host}:${serverAddress.port}/ingest/${sessionId}`,
        logPath: primaryLogPath,
      };

      writeServerLock(logDirectory, {
        pid: process.pid,
        host,
        port: serverAddress.port,
        sessionId,
        endpoint: info.endpoint,
        logPath: primaryLogPath,
      });

      server.on("close", () => removeServerLock(logDirectory));

      resolve({ server, info, reused: false });
    });
    server.on("error", reject);
  });
};
