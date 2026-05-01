import {
  CANONICAL_SKILLS_DIR,
  detectInstalledSkillAgents,
  isUniversalSkillAgent,
  skillAgents,
} from "agent-install";
import type { SkillAgentConfig, SkillAgentType } from "agent-install";

export type AgentName = SkillAgentType;
export type AgentDef = SkillAgentConfig;

export const agents = skillAgents;
export const isUniversalAgent = isUniversalSkillAgent;
export const detectInstalledAgents = detectInstalledSkillAgents;

export { CANONICAL_SKILLS_DIR };
