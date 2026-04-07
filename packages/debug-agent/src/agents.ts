import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const homeDirectory = homedir();

export interface AgentDef {
  displayName: string;
  skillsDir: string;
  globalSkillsDir: string;
  detect: () => boolean;
}

export const CANONICAL_SKILLS_DIR = ".agents/skills";

export const agents: Record<string, AgentDef> = {
  cursor: {
    displayName: "Cursor",
    skillsDir: ".agents/skills",
    globalSkillsDir: join(homeDirectory, ".cursor/skills"),
    detect: () => existsSync(join(homeDirectory, ".cursor")),
  },
  "claude-code": {
    displayName: "Claude Code",
    skillsDir: ".claude/skills",
    globalSkillsDir: join(homeDirectory, ".claude/skills"),
    detect: () => existsSync(join(homeDirectory, ".claude")),
  },
  codex: {
    displayName: "Codex",
    skillsDir: ".agents/skills",
    globalSkillsDir: join(homeDirectory, ".codex/skills"),
    detect: () => existsSync(join(homeDirectory, ".codex")),
  },
  "github-copilot": {
    displayName: "GitHub Copilot",
    skillsDir: ".agents/skills",
    globalSkillsDir: join(homeDirectory, ".copilot/skills"),
    detect: () => existsSync(join(homeDirectory, ".copilot")),
  },
  "gemini-cli": {
    displayName: "Gemini CLI",
    skillsDir: ".agents/skills",
    globalSkillsDir: join(homeDirectory, ".gemini/skills"),
    detect: () => existsSync(join(homeDirectory, ".gemini")),
  },
  windsurf: {
    displayName: "Windsurf",
    skillsDir: ".windsurf/skills",
    globalSkillsDir: join(homeDirectory, ".codeium/windsurf/skills"),
    detect: () => existsSync(join(homeDirectory, ".codeium/windsurf")),
  },
  amp: {
    displayName: "Amp",
    skillsDir: ".agents/skills",
    globalSkillsDir: join(homeDirectory, ".config/agents/skills"),
    detect: () => existsSync(join(homeDirectory, ".config/amp")),
  },
  opencode: {
    displayName: "OpenCode",
    skillsDir: ".agents/skills",
    globalSkillsDir: join(homeDirectory, ".config/opencode/skills"),
    detect: () => existsSync(join(homeDirectory, ".config/opencode")),
  },
};

export const isUniversalAgent = (agentDefinition: AgentDef): boolean =>
  agentDefinition.skillsDir === CANONICAL_SKILLS_DIR;

export const detectInstalledAgents = (): Array<[string, AgentDef]> =>
  Object.entries(agents).filter(([_agentKey, agentDefinition]) => agentDefinition.detect());
