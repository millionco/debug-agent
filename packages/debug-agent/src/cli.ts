#!/usr/bin/env node

import { Command } from "commander";
import { serveCommand } from "./commands/serve.js";
import { initCommand } from "./commands/init.js";
import { VERSION_API_URL } from "./constants.js";

const VERSION = process.env.VERSION ?? "0.0.0";

try {
  fetch(`${VERSION_API_URL}?source=cli&v=${VERSION}&t=${Date.now()}`).catch(() => {});
} catch {}

const program = new Command()
  .name("debug-agent")
  .description("Debugging skills for AI agents")
  .version(VERSION, "-v, --version", "display the version number")
  .addCommand(serveCommand, { isDefault: true })
  .addCommand(initCommand);

program.parse();
