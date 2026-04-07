import { Command } from "commander";
import { createServer } from "../server.js";

export const serveCommand = new Command("serve")
  .description("Start the NDJSON logging server")
  .option("-p, --port <number>", "port to listen on (default: random)", parseInt)
  .option("-H, --host <address>", "host to bind to", "127.0.0.1")
  .option("-s, --session-id <id>", "session ID (default: random 6-char hex)")
  .option("-l, --log-path <path>", "log file path (default: .agents/debug-<sessionId>.log)")
  .action(async (options) => {
    const { server, info } = await createServer({
      port: options.port,
      host: options.host,
      sessionId: options.sessionId,
      logPath: options.logPath,
    });

    console.log(JSON.stringify(info));

    if (!server) {
      return;
    }

    const shutdown = () => {
      server.close();
      process.exit(0);
    };

    process.on("SIGINT", shutdown);
    process.on("SIGTERM", shutdown);
  });
