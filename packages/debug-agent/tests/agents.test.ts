import { describe, it, expect } from "vite-plus/test";
import { agents, isUniversalAgent, CANONICAL_SKILLS_DIR } from "../src/agents.js";

describe("agents", () => {
  it("defines all expected agents", () => {
    const expectedAgents = [
      "cursor",
      "claude-code",
      "codex",
      "github-copilot",
      "gemini-cli",
      "windsurf",
      "amp",
      "opencode",
    ];
    expect(Object.keys(agents)).toEqual(expectedAgents);
  });

  it("every agent has required fields", () => {
    for (const [agentKey, agentDefinition] of Object.entries(agents)) {
      expect(agentDefinition.displayName, `${agentKey} missing displayName`).toBeTruthy();
      expect(agentDefinition.skillsDir, `${agentKey} missing skillsDir`).toBeTruthy();
      expect(agentDefinition.globalSkillsDir, `${agentKey} missing globalSkillsDir`).toBeTruthy();
      expect(typeof agentDefinition.detect, `${agentKey} detect is not a function`).toBe(
        "function",
      );
    }
  });
});

describe("isUniversalAgent", () => {
  it("returns true for agents using the canonical skills dir", () => {
    const universalAgent = {
      displayName: "Test",
      skillsDir: CANONICAL_SKILLS_DIR,
      globalSkillsDir: "/tmp/skills",
      detect: () => false,
    };
    expect(isUniversalAgent(universalAgent)).toBe(true);
  });

  it("returns false for agents with custom skills dirs", () => {
    const customAgent = {
      displayName: "Test",
      skillsDir: ".custom/skills",
      globalSkillsDir: "/tmp/skills",
      detect: () => false,
    };
    expect(isUniversalAgent(customAgent)).toBe(false);
  });

  it("identifies cursor as a universal agent", () => {
    expect(isUniversalAgent(agents.cursor)).toBe(true);
  });

  it("identifies windsurf as a non-universal agent", () => {
    expect(isUniversalAgent(agents.windsurf)).toBe(false);
  });
});
