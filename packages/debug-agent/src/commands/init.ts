import { Command } from "commander";
import prompts from "prompts";
import { init } from "../init.js";
import { agents, detectInstalledAgents } from "../agents.js";

export const initCommand = new Command("init")
  .description("Install the debug skill for detected agents")
  .option("-g, --global", "install globally instead of in the current project")
  .option("-a, --agent <names...>", "target specific agents (e.g. cursor claude-code)")
  .option("--copy", "copy files instead of symlinking")
  .option("--list", "list available agents and exit")
  .action(async (options) => {
    if (options.list) {
      for (const [agentKey, agentDefinition] of Object.entries(agents)) {
        const detectionIndicator = agentDefinition.detect() ? "✓" : " ";
        console.log(`  [${detectionIndicator}] ${agentKey} — ${agentDefinition.displayName}`);
      }
      return;
    }

    let selectedAgents: string[] | undefined = options.agent;

    if (!selectedAgents) {
      const installedAgents = detectInstalledAgents();

      const response = await prompts({
        type: "multiselect",
        name: "agents",
        message: "Select agents to install the debug skill for",
        choices: Object.entries(agents).map(([agentKey, agentDefinition]) => ({
          title: agentDefinition.displayName,
          value: agentKey,
          selected: installedAgents.some(([installedKey]) => installedKey === agentKey),
        })),
        hint: "Space to select, Enter to confirm",
      });

      if (!response.agents || response.agents.length === 0) {
        console.log("No agents selected.");
        return;
      }

      selectedAgents = response.agents;
    }

    const initResult = init({
      global: options.global,
      agent: selectedAgents,
      copy: options.copy,
    });

    if (initResult.errors.length > 0) {
      for (const error of initResult.errors) {
        console.error(`error: ${error}`);
      }
    }

    console.log(`Installed debug skill to ${initResult.canonicalPath}`);

    if (initResult.linkedAgents.length > 0) {
      console.log(`Linked for: ${initResult.linkedAgents.join(", ")}`);
    }
  });
