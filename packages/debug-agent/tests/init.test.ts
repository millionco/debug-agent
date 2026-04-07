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

  it("re-running init overwrites existing skill file", () => {
    const firstResult = init({ cwd: tempDirectory, agent: ["cursor"] });
    const skillPath = path.join(firstResult.canonicalPath, "SKILL.md");
    const firstContent = fs.readFileSync(skillPath, "utf-8");

    const secondResult = init({ cwd: tempDirectory, agent: ["cursor"] });
    const secondContent = fs.readFileSync(
      path.join(secondResult.canonicalPath, "SKILL.md"),
      "utf-8",
    );

    expect(firstContent).toBe(secondContent);
    expect(firstResult.canonicalPath).toBe(secondResult.canonicalPath);
  });

  it("symlink for non-universal agent points to canonical directory", () => {
    const result = init({ cwd: tempDirectory, agent: ["windsurf"] });

    const windsurfSkillDirectory = path.join(tempDirectory, ".windsurf/skills/debug-agent");
    const symlinkTarget = fs.readlinkSync(windsurfSkillDirectory);
    const resolvedTarget = path.resolve(path.dirname(windsurfSkillDirectory), symlinkTarget);

    expect(resolvedTarget).toBe(result.canonicalPath);
  });

  it("creates skill content with non-zero length", () => {
    const result = init({ cwd: tempDirectory, agent: [] });
    const skillPath = path.join(result.canonicalPath, "SKILL.md");
    const skillContent = fs.readFileSync(skillPath, "utf-8");

    expect(skillContent).toContain("debug");
    expect(skillContent.length).toBeGreaterThan(100);
  });

  it("returns empty linkedAgents when no agents specified", () => {
    const result = init({ cwd: tempDirectory, agent: [] });

    expect(result.linkedAgents).toHaveLength(0);
    expect(result.errors).toHaveLength(0);
  });
});
