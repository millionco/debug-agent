import { DurableObject } from "cloudflare:workers";
import {
  MAX_ENTRY_SIZE_BYTES,
  MAX_LOG_ENTRIES,
  MAX_TOTAL_STORAGE_BYTES,
  SESSION_TTL_MS,
} from "./constants.js";

interface LogPayload {
  id?: unknown;
  sessionId?: unknown;
  timestamp?: unknown;
  [key: string]: unknown;
}

interface CountRow extends Record<string, SqlStorageValue> {
  count: number;
}

interface TotalRow extends Record<string, SqlStorageValue> {
  total: number | null;
}

interface DataRow extends Record<string, SqlStorageValue> {
  data: string;
}

interface ExistsRow extends Record<string, SqlStorageValue> {
  one: number;
}

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

const jsonResponse = (body: unknown, init: ResponseInit = {}): Response =>
  new Response(JSON.stringify(body), {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...CORS_HEADERS,
      ...init.headers,
    },
  });

const sseEvent = (event: string, data: unknown): string =>
  `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;

export class LogSession extends DurableObject<Env> {
  private initialized = false;
  private createdAt = 0;
  private sseWriters = new Set<WritableStreamDefaultWriter<Uint8Array>>();
  private textEncoder = new TextEncoder();

  override async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const action = url.pathname.split("/").pop() || "";

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    if (action === "init" && request.method === "POST") {
      const sessionId = url.searchParams.get("sessionId") || "";
      const workerOrigin = url.searchParams.get("origin") || "";
      await this.ensureInitialized();
      return jsonResponse({
        sessionId,
        endpoint: `${workerOrigin}/s/${sessionId}`,
        streamUrl: `${workerOrigin}/s/${sessionId}/stream`,
        expiresAt: this.createdAt + SESSION_TTL_MS,
      });
    }

    if (!(await this.sessionExists())) {
      return jsonResponse({ error: "Session expired or not found" }, { status: 410 });
    }

    if (action === "log" && request.method === "POST") {
      return this.handleIngest(request, url);
    }

    if (action === "log" && request.method === "GET") {
      return this.handleReadAll();
    }

    if (action === "stream" && request.method === "GET") {
      return this.handleStream(url);
    }

    if (action === "log" && request.method === "DELETE") {
      return this.handleClear();
    }

    return jsonResponse({ error: "Not found" }, { status: 404 });
  }

  override async alarm(): Promise<void> {
    for (const writer of this.sseWriters) {
      try {
        await writer.write(
          this.textEncoder.encode(sseEvent("expired", { reason: "Session expired after 1 hour" })),
        );
        await writer.close();
      } catch {}
    }
    this.sseWriters.clear();
    await this.ctx.storage.deleteAll();
    this.initialized = false;
    this.createdAt = 0;
  }

  private async sessionExists(): Promise<boolean> {
    if (this.initialized) return true;
    const createdAt = await this.ctx.storage.get<number>("createdAt");
    if (typeof createdAt !== "number") return false;
    this.createdAt = createdAt;
    this.ensureSchema();
    this.initialized = true;
    return true;
  }

  private async ensureInitialized(): Promise<void> {
    if (this.initialized) return;
    const existingCreatedAt = await this.ctx.storage.get<number>("createdAt");
    if (typeof existingCreatedAt === "number") {
      this.createdAt = existingCreatedAt;
    } else {
      this.createdAt = Date.now();
      await this.ctx.storage.put("createdAt", this.createdAt);
      await this.ctx.storage.setAlarm(this.createdAt + SESSION_TTL_MS);
    }
    this.ensureSchema();
    this.initialized = true;
  }

  private ensureSchema(): void {
    this.ctx.storage.sql.exec(
      `CREATE TABLE IF NOT EXISTS logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        entry_id TEXT,
        data TEXT NOT NULL,
        created_at INTEGER NOT NULL DEFAULT (unixepoch('subsec') * 1000)
      )`,
    );
    this.ctx.storage.sql.exec(`CREATE INDEX IF NOT EXISTS logs_entry_id_idx ON logs(entry_id)`);
  }

  private async handleIngest(request: Request, url: URL): Promise<Response> {
    const sessionId = url.searchParams.get("sessionId") || "";
    let payload: LogPayload;
    try {
      payload = (await request.json()) as LogPayload;
    } catch {
      return jsonResponse({ error: "Invalid JSON" }, { status: 400 });
    }

    const entryId = typeof payload.id === "string" ? payload.id : null;
    if (entryId) {
      const duplicateRow = this.ctx.storage.sql
        .exec<ExistsRow>("SELECT 1 AS one FROM logs WHERE entry_id = ? LIMIT 1", entryId)
        .toArray();
      if (duplicateRow.length > 0) {
        return jsonResponse({ ok: true, duplicate: true });
      }
    }

    if (!payload.sessionId) payload.sessionId = sessionId;
    if (!payload.timestamp) payload.timestamp = Date.now();

    const serialized = JSON.stringify(payload);
    const entryByteLength = this.textEncoder.encode(serialized).byteLength;

    if (entryByteLength > MAX_ENTRY_SIZE_BYTES) {
      return jsonResponse(
        {
          error: "Log entry too large",
          maxBytes: MAX_ENTRY_SIZE_BYTES,
          actualBytes: entryByteLength,
        },
        { status: 413 },
      );
    }

    const countRow = this.ctx.storage.sql
      .exec<CountRow>("SELECT COUNT(*) AS count FROM logs")
      .one();
    if (countRow.count >= MAX_LOG_ENTRIES) {
      return jsonResponse(
        { error: "Maximum log entries reached", maxEntries: MAX_LOG_ENTRIES },
        { status: 413 },
      );
    }

    const totalRow = this.ctx.storage.sql
      .exec<TotalRow>("SELECT COALESCE(SUM(LENGTH(data)), 0) AS total FROM logs")
      .one();
    const currentTotalBytes = totalRow.total ?? 0;
    if (currentTotalBytes + entryByteLength > MAX_TOTAL_STORAGE_BYTES) {
      return jsonResponse(
        {
          error: "Maximum storage size reached",
          maxBytes: MAX_TOTAL_STORAGE_BYTES,
          currentBytes: currentTotalBytes,
        },
        { status: 413 },
      );
    }

    this.ctx.storage.sql.exec(
      "INSERT INTO logs (entry_id, data) VALUES (?, ?)",
      entryId,
      serialized,
    );

    await this.broadcast(sseEvent("log", payload));

    return jsonResponse({ ok: true });
  }

  private handleReadAll(): Response {
    const rows = this.ctx.storage.sql
      .exec<DataRow>("SELECT data FROM logs ORDER BY id ASC")
      .toArray();
    const body = rows.map((innerRow) => innerRow.data).join("\n");
    return new Response(body, {
      status: 200,
      headers: {
        "Content-Type": "application/x-ndjson",
        ...CORS_HEADERS,
      },
    });
  }

  private async handleStream(url: URL): Promise<Response> {
    const sessionId = url.searchParams.get("sessionId") || "";
    const stream = new TransformStream<Uint8Array, Uint8Array>();
    const writer = stream.writable.getWriter();
    this.sseWriters.add(writer);

    const rows = this.ctx.storage.sql
      .exec<DataRow>("SELECT data FROM logs ORDER BY id ASC")
      .toArray();

    const connectedPayload = {
      sessionId,
      expiresAt: this.createdAt + SESSION_TTL_MS,
      bufferedLogs: rows.length,
    };

    const removeWriter = () => {
      this.sseWriters.delete(writer);
      try {
        writer.close();
      } catch {}
    };

    this.ctx.waitUntil(
      (async () => {
        try {
          await writer.write(this.textEncoder.encode(sseEvent("connected", connectedPayload)));
          for (const innerRow of rows) {
            let parsed: unknown;
            try {
              parsed = JSON.parse(innerRow.data);
            } catch {
              parsed = innerRow.data;
            }
            await writer.write(this.textEncoder.encode(sseEvent("log", parsed)));
          }
          await writer.write(this.textEncoder.encode(sseEvent("replay-complete", {})));
        } catch {
          removeWriter();
        }
      })(),
    );

    return new Response(stream.readable, {
      status: 200,
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
        ...CORS_HEADERS,
      },
    });
  }

  private handleClear(): Response {
    this.ctx.storage.sql.exec("DELETE FROM logs");
    return jsonResponse({ ok: true, cleared: true });
  }

  private async broadcast(payload: string): Promise<void> {
    if (this.sseWriters.size === 0) return;
    const chunk = this.textEncoder.encode(payload);
    const failed: WritableStreamDefaultWriter<Uint8Array>[] = [];
    await Promise.all(
      Array.from(this.sseWriters).map(async (innerWriter) => {
        try {
          await innerWriter.write(chunk);
        } catch {
          failed.push(innerWriter);
        }
      }),
    );
    for (const innerWriter of failed) {
      this.sseWriters.delete(innerWriter);
      try {
        innerWriter.close();
      } catch {}
    }
  }
}
