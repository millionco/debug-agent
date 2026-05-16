import { Command } from "commander";
import { DEFAULT_REMOTE_URL } from "../constants.js";
import { logger } from "../utils/logger.js";
import { highlighter } from "../utils/highlighter.js";
import { spinner } from "../utils/spinner.js";
import { parseSseStream } from "../utils/parse-sse-stream.js";
import { getErrorMessage } from "../utils/get-error-message.js";

interface RemoteSessionInfo {
  sessionId: string;
  endpoint: string;
  streamUrl: string;
  expiresAt: number;
}

interface RemoteOptions {
  url?: string;
  daemon?: boolean;
  json?: boolean;
}

const stripTrailingSlash = (input: string): string =>
  input.endsWith("/") ? input.slice(0, -1) : input;

const createRemoteSession = async (workerUrl: string): Promise<RemoteSessionInfo> => {
  const response = await fetch(`${stripTrailingSlash(workerUrl)}/sessions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{}",
  });
  if (!response.ok) {
    throw new Error(`Failed to create remote session (HTTP ${response.status})`);
  }
  return (await response.json()) as RemoteSessionInfo;
};

const openStream = async (
  streamUrl: string,
  signal: AbortSignal,
): Promise<ReadableStream<Uint8Array>> => {
  const response = await fetch(streamUrl, {
    method: "GET",
    headers: { Accept: "text/event-stream" },
    signal,
  });
  if (!response.ok || !response.body) {
    throw new Error(`Failed to open SSE stream (HTTP ${response.status})`);
  }
  return response.body;
};

const formatRemainingMinutes = (expiresAt: number): number =>
  Math.max(0, Math.round((expiresAt - Date.now()) / 60_000));

const runDaemon = async (options: RemoteOptions): Promise<void> => {
  const workerUrl = options.url || DEFAULT_REMOTE_URL;
  const sessionInfo = await createRemoteSession(workerUrl);
  console.log(JSON.stringify(sessionInfo));
};

const runJson = async (options: RemoteOptions): Promise<void> => {
  const workerUrl = options.url || DEFAULT_REMOTE_URL;
  const sessionInfo = await createRemoteSession(workerUrl);
  console.log(JSON.stringify(sessionInfo));

  const abortController = new AbortController();
  const shutdown = () => {
    abortController.abort();
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  const stream = await openStream(sessionInfo.streamUrl, abortController.signal);

  for await (const sseEvent of parseSseStream(stream)) {
    if (sseEvent.event === "log") {
      console.log(sseEvent.data);
      continue;
    }
    if (sseEvent.event === "expired") {
      console.log(JSON.stringify({ event: "expired" }));
      process.exit(0);
    }
  }
};

const runInteractive = async (options: RemoteOptions): Promise<void> => {
  const workerUrl = options.url || DEFAULT_REMOTE_URL;

  const createSpinner = spinner("Creating remote session...").start();
  let sessionInfo: RemoteSessionInfo;
  try {
    sessionInfo = await createRemoteSession(workerUrl);
  } catch (error: unknown) {
    createSpinner.fail(`Failed to create remote session: ${getErrorMessage(error)}`);
    process.exit(1);
  }

  const expirationMinutes = formatRemainingMinutes(sessionInfo.expiresAt);
  createSpinner.succeed(`Remote session created (expires in ${expirationMinutes} min)`);
  logger.dim(`  Endpoint: ${sessionInfo.endpoint}`);
  logger.dim(`  Stream:   ${sessionInfo.streamUrl}`);
  logger.break();

  const abortController = new AbortController();
  const shutdown = () => {
    abortController.abort();
    logger.dim("Disconnected.");
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  const stream = await openStream(sessionInfo.streamUrl, abortController.signal);

  for await (const sseEvent of parseSseStream(stream)) {
    if (sseEvent.event === "connected") {
      try {
        const parsedPayload = JSON.parse(sseEvent.data) as { bufferedLogs?: number };
        const bufferedCount = parsedPayload.bufferedLogs ?? 0;
        logger.dim(
          bufferedCount === 0
            ? "Connected. Waiting for logs..."
            : `Connected. Replaying ${bufferedCount} buffered ${bufferedCount === 1 ? "log" : "logs"}...`,
        );
      } catch {
        logger.dim("Connected.");
      }
      continue;
    }

    if (sseEvent.event === "replay-complete") {
      logger.dim("Replay complete. Streaming live logs.");
      logger.break();
      continue;
    }

    if (sseEvent.event === "log") {
      printPrettyLog(sseEvent.data);
      continue;
    }

    if (sseEvent.event === "expired") {
      logger.warn("Session expired after 1 hour. Create a new session to continue.");
      process.exit(0);
    }
  }
};

interface PrettyLogPayload {
  timestamp?: number;
  location?: string;
  message?: string;
  hypothesisId?: string;
  runId?: string;
  data?: unknown;
}

const printPrettyLog = (rawData: string): void => {
  let payload: PrettyLogPayload;
  try {
    payload = JSON.parse(rawData) as PrettyLogPayload;
  } catch {
    logger.log(rawData);
    return;
  }

  const timeLabel =
    typeof payload.timestamp === "number"
      ? new Date(payload.timestamp).toISOString().slice(11, 23)
      : new Date().toISOString().slice(11, 23);

  const locationLabel = payload.location
    ? highlighter.bold(payload.location)
    : highlighter.dim("(no location)");
  const messageLabel = payload.message ?? "";

  const tags: string[] = [];
  if (payload.hypothesisId) tags.push(highlighter.info(`H:${payload.hypothesisId}`));
  if (payload.runId) tags.push(highlighter.dim(`run:${payload.runId}`));
  const tagSuffix = tags.length > 0 ? ` ${tags.join(" ")}` : "";

  logger.log(`${highlighter.dim(timeLabel)} ${locationLabel} ${messageLabel}${tagSuffix}`);

  if (payload.data !== undefined) {
    try {
      const dataString = JSON.stringify(payload.data, null, 2);
      logger.dim(
        dataString
          .split("\n")
          .map((innerLine) => `  ${innerLine}`)
          .join("\n"),
      );
    } catch {
      logger.dim(`  ${String(payload.data)}`);
    }
  }
};

export const remoteCommand = new Command("remote")
  .description("Create a hosted remote logging session for production debugging")
  .option("--url <url>", "override the worker URL", DEFAULT_REMOTE_URL)
  .option("-d, --daemon", "create session, print JSON info, exit")
  .option("--json", "create session and stream logs as NDJSON to stdout")
  .action(async (options: RemoteOptions) => {
    try {
      if (options.daemon) {
        await runDaemon(options);
        return;
      }
      if (options.json) {
        await runJson(options);
        return;
      }
      await runInteractive(options);
    } catch (error: unknown) {
      logger.error(getErrorMessage(error));
      process.exit(1);
    }
  });
