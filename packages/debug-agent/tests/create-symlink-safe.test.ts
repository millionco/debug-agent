import { describe, it, expect, beforeEach, afterEach } from "vite-plus/test";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { createSymlinkSafe } from "../src/utils/create-symlink-safe.js";

describe("createSymlinkSafe", () => {
  let tempDirectory: string;

  beforeEach(() => {
    tempDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "symlink-test-"));
  });

  afterEach(() => {
    fs.rmSync(tempDirectory, { recursive: true, force: true });
  });

  it("creates a symlink to the target", () => {
    const targetDirectory = path.join(tempDirectory, "target");
    fs.mkdirSync(targetDirectory);
    fs.writeFileSync(path.join(targetDirectory, "file.txt"), "hello");

    const linkPath = path.join(tempDirectory, "link");
    const didSucceed = createSymlinkSafe(targetDirectory, linkPath);

    expect(didSucceed).toBe(true);
    expect(fs.lstatSync(linkPath).isSymbolicLink()).toBe(true);
    expect(fs.readFileSync(path.join(linkPath, "file.txt"), "utf-8")).toBe("hello");
  });

  it("creates parent directories for the link", () => {
    const targetDirectory = path.join(tempDirectory, "target");
    fs.mkdirSync(targetDirectory);

    const linkPath = path.join(tempDirectory, "nested", "deep", "link");
    const didSucceed = createSymlinkSafe(targetDirectory, linkPath);

    expect(didSucceed).toBe(true);
    expect(fs.lstatSync(linkPath).isSymbolicLink()).toBe(true);
  });

  it("returns true if symlink already points to same target", () => {
    const targetDirectory = path.join(tempDirectory, "target");
    fs.mkdirSync(targetDirectory);

    const linkPath = path.join(tempDirectory, "link");
    createSymlinkSafe(targetDirectory, linkPath);
    const didSucceed = createSymlinkSafe(targetDirectory, linkPath);

    expect(didSucceed).toBe(true);
    expect(fs.lstatSync(linkPath).isSymbolicLink()).toBe(true);
  });

  it("replaces existing symlink pointing to different target", () => {
    const oldTarget = path.join(tempDirectory, "old-target");
    const newTarget = path.join(tempDirectory, "new-target");
    fs.mkdirSync(oldTarget);
    fs.mkdirSync(newTarget);
    fs.writeFileSync(path.join(newTarget, "marker.txt"), "new");

    const linkPath = path.join(tempDirectory, "link");
    createSymlinkSafe(oldTarget, linkPath);
    const didSucceed = createSymlinkSafe(newTarget, linkPath);

    expect(didSucceed).toBe(true);
    expect(fs.readFileSync(path.join(linkPath, "marker.txt"), "utf-8")).toBe("new");
  });

  it("replaces existing directory at link path", () => {
    const targetDirectory = path.join(tempDirectory, "target");
    fs.mkdirSync(targetDirectory);
    fs.writeFileSync(path.join(targetDirectory, "file.txt"), "from-target");

    const linkPath = path.join(tempDirectory, "link");
    fs.mkdirSync(linkPath);
    fs.writeFileSync(path.join(linkPath, "old.txt"), "stale");

    const didSucceed = createSymlinkSafe(targetDirectory, linkPath);

    expect(didSucceed).toBe(true);
    expect(fs.lstatSync(linkPath).isSymbolicLink()).toBe(true);
    expect(fs.readFileSync(path.join(linkPath, "file.txt"), "utf-8")).toBe("from-target");
  });

  it("uses relative symlink paths", () => {
    const targetDirectory = path.join(tempDirectory, "target");
    fs.mkdirSync(targetDirectory);

    const linkPath = path.join(tempDirectory, "link");
    createSymlinkSafe(targetDirectory, linkPath);

    const symlinkTarget = fs.readlinkSync(linkPath);
    expect(path.isAbsolute(symlinkTarget)).toBe(false);
  });
});
