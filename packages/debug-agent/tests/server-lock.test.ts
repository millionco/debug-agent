import { describe, it, expect, beforeEach, afterEach } from "vite-plus/test";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { readServerLock, writeServerLock, removeServerLock } from "../src/utils/server-lock.js";

const createLockData = (overrides = {}) => ({
  pid: 12345,
  host: "127.0.0.1",
  port: 54321,
  sessionId: "abc123",
  endpoint: "http://127.0.0.1:54321/ingest/abc123",
  logPath: "/tmp/debug-agent/debug-abc123.log",
  ...overrides,
});

describe("server-lock", () => {
  let tempDirectory: string;

  beforeEach(() => {
    tempDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "lock-test-"));
  });

  afterEach(() => {
    fs.rmSync(tempDirectory, { recursive: true, force: true });
  });

  describe("writeServerLock", () => {
    it("creates a lock file with JSON content", () => {
      const lockData = createLockData();
      writeServerLock(tempDirectory, lockData);

      const lockPath = path.join(tempDirectory, "debug-server.lock");
      expect(fs.existsSync(lockPath)).toBe(true);

      const written = JSON.parse(fs.readFileSync(lockPath, "utf-8"));
      expect(written.pid).toBe(12345);
      expect(written.sessionId).toBe("abc123");
      expect(written.port).toBe(54321);
    });

    it("overwrites an existing lock file", () => {
      writeServerLock(tempDirectory, createLockData({ sessionId: "first" }));
      writeServerLock(tempDirectory, createLockData({ sessionId: "second" }));

      const lockData = readServerLock(tempDirectory);
      expect(lockData?.sessionId).toBe("second");
    });
  });

  describe("readServerLock", () => {
    it("returns lock data when file exists", () => {
      writeServerLock(tempDirectory, createLockData());

      const lockData = readServerLock(tempDirectory);
      expect(lockData).not.toBeNull();
      expect(lockData?.pid).toBe(12345);
      expect(lockData?.host).toBe("127.0.0.1");
      expect(lockData?.endpoint).toContain("abc123");
    });

    it("returns null when no lock file exists", () => {
      expect(readServerLock(tempDirectory)).toBeNull();
    });

    it("returns null when lock file contains invalid JSON", () => {
      const lockPath = path.join(tempDirectory, "debug-server.lock");
      fs.writeFileSync(lockPath, "not-json{{{");

      expect(readServerLock(tempDirectory)).toBeNull();
    });
  });

  describe("removeServerLock", () => {
    it("deletes the lock file", () => {
      writeServerLock(tempDirectory, createLockData());
      const lockPath = path.join(tempDirectory, "debug-server.lock");

      expect(fs.existsSync(lockPath)).toBe(true);
      removeServerLock(tempDirectory);
      expect(fs.existsSync(lockPath)).toBe(false);
    });

    it("does nothing when no lock file exists", () => {
      expect(() => removeServerLock(tempDirectory)).not.toThrow();
    });
  });
});
