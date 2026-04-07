import { Command } from "commander";
import { createServer } from "../server.js";
import { logger } from "../utils/logger.js";
import { highlighter } from "../utils/highlighter.js";
import { spinner } from "../utils/spinner.js";

export const serveCommand = new Command("serve")
  .description("Start the NDJSON logging server")
  .option("-p, --port <number>", "port to listen on (default: random)", parseInt)
  .option("-H, --host <address>", "host to bind to", "127.0.0.1")
  .option("-s, --session-id <id>", "session ID (default: random 6-char hex)")
  .option(
    "-l, --log-path <path>",
    "log file path (default: <tmpdir>/debug-agent/debug-<sessionId>.log)",
  )
  .action(async (options) => {
    const startSpinner = spinner("Starting debug-agent server...").start();

    const { server, info } = await createServer({
      port: options.port,
      host: options.host,
      sessionId: options.sessionId,
      logPath: options.logPath,
    });

    if (!server) {
      startSpinner.succeed(`Server already running on port ${highlighter.bold(String(info.port))}`);
      logger.dim(`  ${info.endpoint}`);
      return;
    }

    startSpinner.succeed(`Server listening on port ${highlighter.bold(String(info.port))}`);
    logger.dim(`  Endpoint: ${info.endpoint}`);
    logger.dim(`  Log path: ${info.logPath}`);

    const shutdown = () => {
      server.close();
      process.exit(0);
    };

    process.on("SIGINT", shutdown);
    process.on("SIGTERM", shutdown);
  });
