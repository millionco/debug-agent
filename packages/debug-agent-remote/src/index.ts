import { nanoid } from "nanoid";
import { NANOID_LENGTH } from "./constants.js";
import { LogSession } from "./log-session.js";

export { LogSession };

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

const SESSION_ID_PATTERN = /^[A-Za-z0-9_-]{8,64}$/;

const generateSessionId = (): string => nanoid(NANOID_LENGTH);

const jsonResponse = (body: unknown, init: ResponseInit = {}): Response =>
  new Response(JSON.stringify(body), {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...CORS_HEADERS,
      ...init.headers,
    },
  });

const withCors = (response: Response): Response => {
  const headers = new Headers(response.headers);
  for (const [name, value] of Object.entries(CORS_HEADERS)) {
    headers.set(name, value);
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
};

const forwardToSession = async (
  env: Env,
  sessionId: string,
  internalPath: string,
  init: RequestInit,
): Promise<Response> => {
  const doId = env.LOG_SESSION.idFromName(sessionId);
  const stub = env.LOG_SESSION.get(doId);
  const internalUrl = `https://do.internal${internalPath}?sessionId=${encodeURIComponent(sessionId)}`;
  const response = await stub.fetch(internalUrl, init);
  return withCors(response);
};

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    if (url.pathname === "/" && request.method === "GET") {
      return jsonResponse({ ok: true, service: "debug-agent-remote" });
    }

    if (url.pathname === "/sessions" && request.method === "POST") {
      const sessionId = generateSessionId();
      const workerOrigin = `${url.protocol}//${url.host}`;
      const doId = env.LOG_SESSION.idFromName(sessionId);
      const stub = env.LOG_SESSION.get(doId);
      const initUrl =
        `https://do.internal/init?sessionId=${encodeURIComponent(sessionId)}` +
        `&origin=${encodeURIComponent(workerOrigin)}`;
      const initResponse = await stub.fetch(initUrl, { method: "POST" });
      return withCors(initResponse);
    }

    const sessionMatch = url.pathname.match(/^\/s\/([^/]+)(\/stream)?\/?$/);
    if (sessionMatch) {
      const sessionId = sessionMatch[1];
      if (!SESSION_ID_PATTERN.test(sessionId)) {
        return jsonResponse({ error: "Invalid session id" }, { status: 400 });
      }
      const isStream = Boolean(sessionMatch[2]);

      if (isStream) {
        if (request.method !== "GET") {
          return jsonResponse({ error: "Method not allowed" }, { status: 405 });
        }
        return forwardToSession(env, sessionId, "/stream", { method: "GET" });
      }

      if (request.method === "POST") {
        const bodyText = await request.text();
        return forwardToSession(env, sessionId, "/log", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: bodyText,
        });
      }

      if (request.method === "GET") {
        return forwardToSession(env, sessionId, "/log", { method: "GET" });
      }

      if (request.method === "DELETE") {
        return forwardToSession(env, sessionId, "/log", { method: "DELETE" });
      }

      return jsonResponse({ error: "Method not allowed" }, { status: 405 });
    }

    return jsonResponse({ error: "Not found" }, { status: 404 });
  },
} satisfies ExportedHandler<Env>;
