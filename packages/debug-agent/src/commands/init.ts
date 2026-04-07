import { Command } from "commander";
import prompts from "prompts";
import { init } from "../init.js";
import { agents, detectInstalledAgents } from "../agents.js";
import { logger } from "../utils/logger.js";
import { highlighter } from "../utils/highlighter.js";
import { spinner } from "../utils/spinner.js";

export const initCommand = new Command("init")
  .description("Install the debug skill for detected agents")
  .option("-g, --global", "install globally instead of in the current project")
  .option("-a, --agent <names...>", "target specific agents (e.g. cursor claude-code)")
  .option("--copy", "copy files instead of symlinking")
  .option("--list", "list available agents and exit")
  .action(async (options) => {
    if (options.list) {
      logger.break();
      for (const [agentKey, agentDefinition] of Object.entries(agents)) {
        const detectionIndicator = agentDefinition.detect()
          ? highlighter.success("✓")
          : highlighter.dim("·");
        logger.log(
          `  ${detectionIndicator} ${highlighter.bold(agentDefinition.displayName)} ${highlighter.dim(agentKey)}`,
        );
      }
      logger.break();
      return;
    }

    let selectedAgents: string[] | undefined = options.agent;

    if (!selectedAgents) {
      const installedAgents = detectInstalledAgents();

      logger.break();
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
        logger.warn("No agents selected.");
        return;
      }

      selectedAgents = response.agents;
    }

    const installSpinner = spinner("Installing debug-agent skill...").start();

    const initResult = init({
      global: options.global,
      agent: selectedAgents,
      copy: options.copy,
    });

    if (initResult.errors.length > 0) {
      for (const error of initResult.errors) {
        logger.error(`  ${error}`);
      }
    }

    if (initResult.linkedAgents.length > 0) {
      installSpinner.succeed(`Installed to ${highlighter.dim(initResult.canonicalPath)}`);
      logger.dim(`  Linked for: ${initResult.linkedAgents.join(", ")}`);
    } else {
      installSpinner.fail("No agents were installed.");
    }

    logger.break();
  });
