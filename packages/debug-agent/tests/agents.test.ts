import { describe, it, expect } from "vite-plus/test";
import {
  agents,
  isUniversalAgent,
  detectInstalledAgents,
  CANONICAL_SKILLS_DIR,
} from "../src/agents.js";

describe("agents", () => {
  it("re-exports agent-install's agent registry with the expected agents", () => {
    const expectedAgents = [
      "claude-code",
      "codex",
      "cursor",
      "gemini-cli",
      "github-copilot",
      "goose",
      "opencode",
      "windsurf",
      "roo",
      "cline",
      "kilo",
      "universal",
    ];
    for (const expectedAgent of expectedAgents) {
      expect(agents[expectedAgent], `missing agent: ${expectedAgent}`).toBeTruthy();
    }
  });

  it("every agent has the required SkillAgentConfig fields", () => {
    for (const [agentKey, agentDefinition] of Object.entries(agents)) {
      expect(agentDefinition.name, `${agentKey} missing name`).toBe(agentKey);
      expect(agentDefinition.displayName, `${agentKey} missing displayName`).toBeTruthy();
      expect(agentDefinition.skillsDir, `${agentKey} missing skillsDir`).toBeTruthy();
      expect(
        typeof agentDefinition.detectInstalled,
        `${agentKey} detectInstalled is not a function`,
      ).toBe("function");
    }
  });
});

describe("isUniversalAgent", () => {
  it("identifies cursor as a universal agent", () => {
    expect(isUniversalAgent("cursor")).toBe(true);
  });

  it("identifies windsurf as a non-universal agent", () => {
    expect(isUniversalAgent("windsurf")).toBe(false);
  });

  it("identifies claude-code as a non-universal agent", () => {
    expect(isUniversalAgent("claude-code")).toBe(false);
  });

  it("identifies codex as a universal agent", () => {
    expect(isUniversalAgent("codex")).toBe(true);
  });

  it("CANONICAL_SKILLS_DIR is .agents/skills", () => {
    expect(CANONICAL_SKILLS_DIR).toBe(".agents/skills");
  });
});

describe("detectInstalledAgents", () => {
  it("returns an array of agent keys", async () => {
    const installed = await detectInstalledAgents();
    expect(Array.isArray(installed)).toBe(true);

    for (const agentKey of installed) {
      expect(typeof agentKey).toBe("string");
      expect(agents[agentKey]).toBeTruthy();
    }
  });

  it("only returns agents whose detectInstalled returns true", async () => {
    const installed = await detectInstalledAgents();
    for (const agentKey of installed) {
      const isStillInstalled = await agents[agentKey].detectInstalled();
      expect(isStillInstalled).toBe(true);
    }
  });
});
