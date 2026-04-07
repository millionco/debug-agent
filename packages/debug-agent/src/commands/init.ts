import { Command } from "commander";
import { init } from "../init.js";
import { agents } from "../agents.js";
import { AGENT_NAME_PAD_WIDTH } from "../constants.js";

export const initCommand = new Command("init")
  .description("Install the debug-mode skill for detected agents")
  .option("-g, --global", "install globally instead of in the current project")
  .option("-a, --agent <names...>", "target specific agents (e.g. cursor claude-code)")
  .option("--copy", "copy files instead of symlinking")
  .option("--list", "list available agents and exit")
  .action((options) => {
    if (options.list) {
      const agentList = Object.entries(agents).map(([agentKey, agentDefinition]) => {
        const detectionIndicator = agentDefinition.detect() ? "✓" : " ";
        return `  [${detectionIndicator}] ${agentKey.padEnd(AGENT_NAME_PAD_WIDTH)} ${agentDefinition.displayName}`;
      });
      console.log("Available agents:\n");
      console.log(agentList.join("\n"));
      return;
    }

    const initResult = init({
      global: options.global,
      agent: options.agent,
      copy: options.copy,
    });

    if (initResult.errors.length > 0) {
      for (const error of initResult.errors) {
        console.error(`error: ${error}`);
      }
    }

    console.log(`Installed debug-mode skill to ${initResult.canonicalPath}`);

    if (initResult.linkedAgents.length > 0) {
      console.log(`Linked for: ${initResult.linkedAgents.join(", ")}`);
    }
  });
