import { Command } from "commander";
import { spawn } from "node:child_process";
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
  .option("-d, --daemon", "start server in background and exit")
  .option("--json", "output server info as JSON (no spinner/colors)")
  .action(async (options) => {
    if (options.daemon) {
      await startDaemon(options);
      return;
    }

    if (options.json) {
      await startJson(options);
      return;
    }

    await startInteractive(options);
  });

interface ServeOptions {
  port?: number;
  host: string;
  sessionId?: string;
  logPath?: string;
}

const startDaemon = async (options: ServeOptions) => {
  const childArgs = [process.argv[1], "serve", "--json"];
  if (options.port) childArgs.push("-p", String(options.port));
  if (options.host !== "127.0.0.1") childArgs.push("-H", options.host);
  if (options.sessionId) childArgs.push("-s", options.sessionId);
  if (options.logPath) childArgs.push("-l", options.logPath);

  const childProcess = spawn(process.execPath, childArgs, {
    detached: true,
    stdio: ["ignore", "pipe", "ignore"],
  });

  if (!childProcess.stdout) {
    logger.error("Failed to start daemon");
    process.exit(1);
  }

  let stdoutBuffer = "";
  const serverInfoLine = await new Promise<string>((resolve, reject) => {
    childProcess.stdout!.on("data", (chunk: Buffer) => {
      stdoutBuffer += chunk.toString();
      const newlineIndex = stdoutBuffer.indexOf("\n");
      if (newlineIndex !== -1) {
        resolve(stdoutBuffer.slice(0, newlineIndex));
      }
    });
    childProcess.on("error", reject);
    childProcess.on("exit", (code) => {
      if (code !== 0) reject(new Error(`Server process exited with code ${code}`));
    });
  });

  console.log(serverInfoLine);
  childProcess.unref();
  process.exit(0);
};

const startJson = async (options: ServeOptions) => {
  const { server, info } = await createServer({
    port: options.port,
    host: options.host,
    sessionId: options.sessionId,
    logPath: options.logPath,
  });

  console.log(JSON.stringify(info));

  if (!server) {
    process.exit(0);
  }

  const shutdown = () => {
    server.close();
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
};

const startInteractive = async (options: ServeOptions) => {
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
};
