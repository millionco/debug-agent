#!/usr/bin/env node

import { Command } from "commander";
import { serveCommand } from "./commands/serve.js";
import { initCommand } from "./commands/init.js";

const program = new Command()
  .name("debug-agent")
  .description("Debugging skills for AI agents")
  .addCommand(serveCommand, { isDefault: true })
  .addCommand(initCommand);

program.parse();
