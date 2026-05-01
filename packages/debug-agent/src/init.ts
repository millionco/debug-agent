import { homedir } from "node:os";
import path from "node:path";
import {
  CANONICAL_SKILLS_DIR,
  detectInstalledSkillAgents,
  installSkillsFromSource,
  isSkillAgentType,
} from "agent-install";
import type { InstallMode, SkillAgentType } from "agent-install";

const SKILL_NAME = "debug-agent";

const getSkillSourceDirectory = (): string => path.resolve(import.meta.dirname, "..", "skill");

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

interface ResolvedAgents {
  agents: SkillAgentType[];
  userIncludedUniversal: boolean;
}

const resolveRequestedAgents = async (
  requestedAgents: string[] | undefined,
  errors: string[],
): Promise<ResolvedAgents> => {
  if (requestedAgents === undefined) {
    return {
      agents: await detectInstalledSkillAgents(),
      userIncludedUniversal: false,
    };
  }

  const validAgents: SkillAgentType[] = [];
  let userIncludedUniversal = false;

  for (const agentName of requestedAgents) {
    if (isSkillAgentType(agentName)) {
      if (agentName === "universal") userIncludedUniversal = true;
      validAgents.push(agentName);
    } else {
      errors.push(`Unknown agent: ${agentName}`);
    }
  }

  return { agents: validAgents, userIncludedUniversal };
};

export const init = async (options: InitOptions = {}): Promise<InitResult> => {
  const isGlobal = options.global ?? false;
  const workingDirectory = options.cwd || process.cwd();
  const installMode: InstallMode = options.copy ? "copy" : "symlink";

  const canonicalPath = path.join(
    isGlobal ? homedir() : workingDirectory,
    CANONICAL_SKILLS_DIR,
    SKILL_NAME,
  );

  const errors: string[] = [];
  const { agents: requestedAgents, userIncludedUniversal } = await resolveRequestedAgents(
    options.agent,
    errors,
  );

  const agentsToInstall: SkillAgentType[] = requestedAgents.includes("universal")
    ? requestedAgents
    : [...requestedAgents, "universal"];

  const installResult = await installSkillsFromSource({
    source: getSkillSourceDirectory(),
    agents: agentsToInstall,
    cwd: workingDirectory,
    global: isGlobal,
    mode: installMode,
  });

  for (const failure of installResult.failed) {
    errors.push(`${failure.agent}: ${failure.error}`);
  }

  const linkedAgentSet = new Set<string>();
  for (const installed of installResult.installed) {
    if (!userIncludedUniversal && installed.agent === "universal") continue;
    linkedAgentSet.add(installed.agent);
  }

  return {
    canonicalPath,
    linkedAgents: [...linkedAgentSet],
    errors,
  };
};
