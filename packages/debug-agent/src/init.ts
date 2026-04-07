import fs from "node:fs";
import { homedir } from "node:os";
import path from "node:path";
import { agents, isUniversalAgent, detectInstalledAgents, CANONICAL_SKILLS_DIR } from "./agents.js";
import { createSymlinkSafe } from "./utils/create-symlink-safe.js";

const SKILL_NAME = "debug";

const getSkillContent = (): string => {
  const skillPath = path.resolve(import.meta.dirname, "..", "skill", "SKILL.md");
  return fs.readFileSync(skillPath, "utf-8");
};

export interface InitOptions {
  global?: boolean;
  agent?: string[];
  copy?: boolean;
  cwd?: string;
}

export interface InitResult {
  canonicalPath: string;
  linkedAgents: string[];
  errors: string[];
}

const writeSkillToDirectory = (directory: string, content: string) => {
  fs.mkdirSync(directory, { recursive: true });
  fs.writeFileSync(path.join(directory, "SKILL.md"), content);
};

export const init = (options: InitOptions = {}): InitResult => {
  const workingDirectory = options.cwd || process.cwd();
  const isGlobal = options.global ?? false;
  const useSymlinks = !(options.copy ?? false);

  const baseDirectory = isGlobal ? homedir() : workingDirectory;
  const canonicalDirectory = path.join(baseDirectory, CANONICAL_SKILLS_DIR, SKILL_NAME);

  const result: InitResult = {
    canonicalPath: canonicalDirectory,
    linkedAgents: [],
    errors: [],
  };

  const skillContent = getSkillContent();

  writeSkillToDirectory(canonicalDirectory, skillContent);

  const agentsToInstall = options.agent
    ? options.agent
        .map((agentName) => [agentName, agents[agentName]] as const)
        .filter(([agentName, agentDefinition]) => {
          if (!agentDefinition) {
            result.errors.push(`Unknown agent: ${agentName}`);
            return false;
          }
          return true;
        })
    : detectInstalledAgents();

  for (const [agentName, agentDefinition] of agentsToInstall) {
    if (!isUniversalAgent(agentDefinition)) {
      const agentSkillsDirectory = isGlobal
        ? agentDefinition.globalSkillsDir
        : path.join(workingDirectory, agentDefinition.skillsDir);
      const agentSkillDirectory = path.join(agentSkillsDirectory, SKILL_NAME);

      const didLink = useSymlinks && createSymlinkSafe(canonicalDirectory, agentSkillDirectory);
      if (!didLink) {
        writeSkillToDirectory(agentSkillDirectory, skillContent);
      }
    }

    result.linkedAgents.push(agentName);
  }

  return result;
};
