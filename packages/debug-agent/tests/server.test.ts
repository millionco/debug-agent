import { describe, it, expect, afterEach } from "vite-plus/test";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { createServer } from "../src/server.js";

const sendRequest = (
  port: number,
  method: string,
  requestPath: string,
  body?: string,
): Promise<{ statusCode: number; body: string }> =>
  new Promise((resolve, reject) => {
    const request = http.request(
      {
        hostname: "127.0.0.1",
        port,
        path: requestPath,
        method,
        headers: { "Content-Type": "application/json" },
      },
      (response) => {
        let responseBody = "";
        response.on("data", (chunk: Buffer) => (responseBody += chunk));
        response.on("end", () =>
          resolve({ statusCode: response.statusCode || 0, body: responseBody }),
        );
      },
    );
    request.on("error", reject);
    if (body) request.write(body);
    request.end();
  });

const closeServer = (server: http.Server): Promise<void> =>
  new Promise((resolve) => server.close(() => resolve()));

describe("createServer", () => {
  let serverInstance: http.Server | null | undefined;
  let tempDirectory: string;

  afterEach(async () => {
    if (serverInstance) {
      await closeServer(serverInstance);
      serverInstance = undefined;
    }
    if (tempDirectory) {
      fs.rmSync(tempDirectory, { recursive: true, force: true });
    }
  });

  const startServer = async (options = {}) => {
    tempDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "server-test-"));
    const result = await createServer({
      cwd: tempDirectory,
      sessionId: "test123",
      ...options,
    });
    serverInstance = result.server;
    return result;
  };

  const ingestPath = "/ingest/test123";

  it("starts and returns server info with reused=false", async () => {
    const { info, reused, server } = await startServer();

    expect(reused).toBe(false);
    expect(server).not.toBeNull();
    expect(info.sessionId).toBe("test123");
    expect(info.port).toBeGreaterThan(0);
    expect(info.endpoint).toContain("test123");
    expect(info.logPath).toContain("debug-test123.log");
  });

  it("writes a lock file on start", async () => {
    await startServer();

    const lockPath = path.join(tempDirectory, "debug-agent", "debug-server.lock");
    expect(fs.existsSync(lockPath)).toBe(true);

    const lockData = JSON.parse(fs.readFileSync(lockPath, "utf-8"));
    expect(lockData.pid).toBe(process.pid);
    expect(lockData.sessionId).toBe("test123");
    expect(lockData.port).toBeGreaterThan(0);
  });

  it("removes lock file when server closes", async () => {
    const { server } = await startServer();
    const lockPath = path.join(tempDirectory, "debug-agent", "debug-server.lock");

    expect(fs.existsSync(lockPath)).toBe(true);
    await closeServer(server!);
    serverInstance = undefined;
    expect(fs.existsSync(lockPath)).toBe(false);
  });

  it("reuses existing server instead of starting a new one", async () => {
    const first = await startServer();
    const second = await createServer({
      cwd: tempDirectory,
      sessionId: "different-session",
    });

    expect(second.reused).toBe(true);
    expect(second.server).toBeNull();
    expect(second.info.port).toBe(first.info.port);
    expect(second.info.sessionId).toBe("test123");
  });

  it("starts fresh when lock file exists but server is dead", async () => {
    tempDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "server-test-"));
    const logDirectory = path.join(tempDirectory, "debug-agent");
    fs.mkdirSync(logDirectory, { recursive: true });

    fs.writeFileSync(
      path.join(logDirectory, "debug-server.lock"),
      JSON.stringify({
        pid: 999999,
        host: "127.0.0.1",
        port: 19999,
        sessionId: "stale",
        endpoint: "http://127.0.0.1:19999/ingest/stale",
        logPath: path.join(logDirectory, "debug-stale.log"),
      }),
    );

    const result = await createServer({
      cwd: tempDirectory,
      sessionId: "fresh",
    });
    serverInstance = result.server;

    expect(result.reused).toBe(false);
    expect(result.server).not.toBeNull();
    expect(result.info.sessionId).toBe("fresh");
  });

  it("handles CORS preflight", async () => {
    const { info } = await startServer();
    const response = await sendRequest(info.port, "OPTIONS", ingestPath);

    expect(response.statusCode).toBe(204);
  });

  it("ingests log entries via POST", async () => {
    const { info } = await startServer();

    const response = await sendRequest(
      info.port,
      "POST",
      ingestPath,
      JSON.stringify({ level: "info", message: "hello" }),
    );
    const parsed = JSON.parse(response.body);

    expect(response.statusCode).toBe(200);
    expect(parsed.ok).toBe(true);

    const logContent = fs.readFileSync(info.logPath, "utf-8");
    const logEntry = JSON.parse(logContent.trim());
    expect(logEntry.level).toBe("info");
    expect(logEntry.message).toBe("hello");
    expect(logEntry.sessionId).toBe("test123");
    expect(logEntry.timestamp).toBeGreaterThan(0);
  });

  it("preserves provided sessionId and timestamp in entries", async () => {
    const { info } = await startServer();

    await sendRequest(
      info.port,
      "POST",
      ingestPath,
      JSON.stringify({ sessionId: "custom", timestamp: 999, data: "test" }),
    );

    const logContent = fs.readFileSync(info.logPath, "utf-8");
    const logEntry = JSON.parse(logContent.trim());
    expect(logEntry.sessionId).toBe("custom");
    expect(logEntry.timestamp).toBe(999);
  });

  it("returns 400 for invalid JSON", async () => {
    const { info } = await startServer();
    const response = await sendRequest(info.port, "POST", ingestPath, "not-json{{{");

    expect(response.statusCode).toBe(400);
    expect(JSON.parse(response.body).error).toBe("Invalid JSON");
  });

  it("reads logs via GET", async () => {
    const { info } = await startServer();

    await sendRequest(info.port, "POST", ingestPath, JSON.stringify({ message: "first" }));
    await sendRequest(info.port, "POST", ingestPath, JSON.stringify({ message: "second" }));

    const response = await sendRequest(info.port, "GET", ingestPath);

    expect(response.statusCode).toBe(200);
    const lines = response.body.trim().split("\n");
    expect(lines).toHaveLength(2);
    expect(JSON.parse(lines[0]).message).toBe("first");
    expect(JSON.parse(lines[1]).message).toBe("second");
  });

  it("returns empty body for GET when no logs exist", async () => {
    const { info } = await startServer();
    const response = await sendRequest(info.port, "GET", ingestPath);

    expect(response.statusCode).toBe(200);
    expect(response.body).toBe("");
  });

  it("clears logs via DELETE", async () => {
    const { info } = await startServer();

    await sendRequest(info.port, "POST", ingestPath, JSON.stringify({ message: "to-delete" }));
    expect(fs.existsSync(info.logPath)).toBe(true);

    const response = await sendRequest(info.port, "DELETE", ingestPath);
    const parsed = JSON.parse(response.body);

    expect(response.statusCode).toBe(200);
    expect(parsed.ok).toBe(true);
    expect(parsed.cleared).toBe(true);
    expect(fs.existsSync(info.logPath)).toBe(false);
  });

  it("DELETE succeeds even when no log file exists", async () => {
    const { info } = await startServer();
    const response = await sendRequest(info.port, "DELETE", ingestPath);

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body).ok).toBe(true);
  });

  it("returns 405 for unsupported methods", async () => {
    const { info } = await startServer();
    const response = await sendRequest(info.port, "PUT", ingestPath);

    expect(response.statusCode).toBe(405);
  });

  it("deduplicates entries with the same id", async () => {
    const { info } = await startServer();

    const entry = JSON.stringify({ id: "abc-123", message: "once" });
    const firstResponse = await sendRequest(info.port, "POST", ingestPath, entry);
    const secondResponse = await sendRequest(info.port, "POST", ingestPath, entry);

    expect(JSON.parse(firstResponse.body).duplicate).toBeUndefined();
    expect(JSON.parse(secondResponse.body).duplicate).toBe(true);

    const logLines = fs.readFileSync(info.logPath, "utf-8").trim().split("\n");
    expect(logLines).toHaveLength(1);
  });

  it("allows entries without id to repeat", async () => {
    const { info } = await startServer();

    const entry = JSON.stringify({ message: "repeat-me" });
    await sendRequest(info.port, "POST", ingestPath, entry);
    await sendRequest(info.port, "POST", ingestPath, entry);

    const logLines = fs.readFileSync(info.logPath, "utf-8").trim().split("\n");
    expect(logLines).toHaveLength(2);
  });

  it("resets idempotency tracking on DELETE", async () => {
    const { info } = await startServer();

    const entry = JSON.stringify({ id: "reset-test", message: "hello" });
    await sendRequest(info.port, "POST", ingestPath, entry);
    await sendRequest(info.port, "DELETE", ingestPath);
    await sendRequest(info.port, "POST", ingestPath, entry);

    const logLines = fs.readFileSync(info.logPath, "utf-8").trim().split("\n");
    expect(logLines).toHaveLength(1);
    expect(JSON.parse(logLines[0]).message).toBe("hello");
  });

  it("sets CORS headers on responses", async () => {
    const { info } = await startServer();
    const response = await sendRequest(info.port, "GET", ingestPath);

    expect(response.statusCode).toBe(200);
  });

  it("appends multiple entries to the same log file", async () => {
    const { info } = await startServer();

    for (let entryIndex = 0; entryIndex < 5; entryIndex++) {
      await sendRequest(info.port, "POST", ingestPath, JSON.stringify({ index: entryIndex }));
    }

    const logLines = fs.readFileSync(info.logPath, "utf-8").trim().split("\n");
    expect(logLines).toHaveLength(5);
    expect(JSON.parse(logLines[0]).index).toBe(0);
    expect(JSON.parse(logLines[4]).index).toBe(4);
  });

  it("uses custom logPath when provided", async () => {
    tempDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "server-test-"));
    const customLogPath = path.join(tempDirectory, "custom.log");

    const result = await createServer({
      cwd: tempDirectory,
      sessionId: "custom-path",
      logPath: customLogPath,
    });
    serverInstance = result.server;

    expect(result.info.logPath).toBe(customLogPath);

    await sendRequest(
      result.info.port,
      "POST",
      "/ingest/custom-path",
      JSON.stringify({ message: "custom" }),
    );
    expect(fs.existsSync(customLogPath)).toBe(true);
  });

  it("handles empty POST body as invalid JSON", async () => {
    const { info } = await startServer();
    const response = await sendRequest(info.port, "POST", ingestPath, "");

    expect(response.statusCode).toBe(400);
  });

  it("tracks different entry ids independently", async () => {
    const { info } = await startServer();

    await sendRequest(info.port, "POST", ingestPath, JSON.stringify({ id: "first", message: "a" }));
    await sendRequest(
      info.port,
      "POST",
      ingestPath,
      JSON.stringify({ id: "second", message: "b" }),
    );
    await sendRequest(info.port, "POST", ingestPath, JSON.stringify({ id: "first", message: "c" }));

    const logLines = fs.readFileSync(info.logPath, "utf-8").trim().split("\n");
    expect(logLines).toHaveLength(2);
    expect(JSON.parse(logLines[0]).id).toBe("first");
    expect(JSON.parse(logLines[1]).id).toBe("second");
  });

  it("generates random sessionId when not provided", async () => {
    tempDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "server-test-"));
    const { server, info } = await createServer({ cwd: tempDirectory });
    serverInstance = server;

    expect(info.sessionId).toMatch(/^[0-9a-f]{6}$/);
  });

  it("returns 200 for health check at GET /", async () => {
    const { info } = await startServer();
    const response = await sendRequest(info.port, "GET", "/");

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body).ok).toBe(true);
  });

  it("returns 404 for unknown paths", async () => {
    const { info } = await startServer();

    const response = await sendRequest(info.port, "GET", "/unknown/path");
    expect(response.statusCode).toBe(404);

    const postResponse = await sendRequest(
      info.port,
      "POST",
      "/wrong",
      JSON.stringify({ message: "nope" }),
    );
    expect(postResponse.statusCode).toBe(404);
  });

  it("routes different session IDs to separate log files", async () => {
    const { info } = await startServer();

    await sendRequest(
      info.port,
      "POST",
      "/ingest/session-a",
      JSON.stringify({ message: "from-a" }),
    );
    await sendRequest(
      info.port,
      "POST",
      "/ingest/session-b",
      JSON.stringify({ message: "from-b" }),
    );

    const logDirectory = path.join(tempDirectory, "debug-agent");
    const logA = fs.readFileSync(path.join(logDirectory, "debug-session-a.log"), "utf-8");
    const logB = fs.readFileSync(path.join(logDirectory, "debug-session-b.log"), "utf-8");

    expect(JSON.parse(logA.trim()).message).toBe("from-a");
    expect(JSON.parse(logB.trim()).message).toBe("from-b");

    expect(fs.existsSync(info.logPath)).toBe(false);
  });
});
