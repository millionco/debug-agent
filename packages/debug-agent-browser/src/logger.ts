export interface Logger {
  debug(message: string, meta?: Record<string, unknown>): void;
  info(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
  error(message: string, meta?: Record<string, unknown>): void;
}

const formatMeta = (meta?: Record<string, unknown>): string =>
  meta && Object.keys(meta).length > 0 ? ` ${JSON.stringify(meta)}` : "";

export const consoleLogger: Logger = {
  debug: (message, meta) => console.debug(`[debug-agent-browser] ${message}${formatMeta(meta)}`),
  info: (message, meta) => console.info(`[debug-agent-browser] ${message}${formatMeta(meta)}`),
  warn: (message, meta) => console.warn(`[debug-agent-browser] ${message}${formatMeta(meta)}`),
  error: (message, meta) => console.error(`[debug-agent-browser] ${message}${formatMeta(meta)}`),
};

export const silentLogger: Logger = {
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {},
};

export const defaultLogger: Logger = consoleLogger;
