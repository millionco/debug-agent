import { describe, it, expect, beforeEach, afterEach } from "vite-plus/test";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { init } from "../src/init.js";

describe("init", () => {
  let tempDirectory: string;

  beforeEach(() => {
    tempDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "init-test-"));
  });

  afterEach(() => {
    fs.rmSync(tempDirectory, { recursive: true, force: true });
  });

  it("writes the skill file to the canonical directory", () => {
    const result = init({ cwd: tempDirectory, agent: [] });

    const skillPath = path.join(result.canonicalPath, "SKILL.md");
    expect(fs.existsSync(skillPath)).toBe(true);
    expect(fs.readFileSync(skillPath, "utf-8").length).toBeGreaterThan(0);
  });

  it("returns errors for unknown agents", () => {
    const result = init({ cwd: tempDirectory, agent: ["nonexistent-agent"] });

    expect(result.errors).toContain("Unknown agent: nonexistent-agent");
  });

  it("installs for a universal agent without creating extra directories", () => {
    const result = init({ cwd: tempDirectory, agent: ["cursor"] });

    expect(result.linkedAgents).toContain("cursor");
    const canonicalSkillPath = path.join(result.canonicalPath, "SKILL.md");
    expect(fs.existsSync(canonicalSkillPath)).toBe(true);
  });

  it("creates symlink for non-universal agents by default", () => {
    const result = init({ cwd: tempDirectory, agent: ["windsurf"] });

    expect(result.linkedAgents).toContain("windsurf");

    const windsurfSkillDirectory = path.join(tempDirectory, ".windsurf/skills/debug-agent");
    const isSymlink = fs.lstatSync(windsurfSkillDirectory).isSymbolicLink();
    expect(isSymlink).toBe(true);
  });

  it("copies files instead of symlinking when copy option is set", () => {
    const result = init({ cwd: tempDirectory, agent: ["windsurf"], copy: true });

    expect(result.linkedAgents).toContain("windsurf");

    const windsurfSkillDirectory = path.join(tempDirectory, ".windsurf/skills/debug-agent");
    expect(fs.lstatSync(windsurfSkillDirectory).isSymbolicLink()).toBe(false);
    expect(fs.existsSync(path.join(windsurfSkillDirectory, "SKILL.md"))).toBe(true);
  });

  it("handles multiple agents", () => {
    const result = init({ cwd: tempDirectory, agent: ["cursor", "windsurf", "claude-code"] });

    expect(result.linkedAgents).toContain("cursor");
    expect(result.linkedAgents).toContain("windsurf");
    expect(result.linkedAgents).toContain("claude-code");
    expect(result.errors).toHaveLength(0);
  });

  it("mixes valid and invalid agents", () => {
    const result = init({ cwd: tempDirectory, agent: ["cursor", "fake-agent"] });

    expect(result.linkedAgents).toContain("cursor");
    expect(result.errors).toContain("Unknown agent: fake-agent");
  });
});
