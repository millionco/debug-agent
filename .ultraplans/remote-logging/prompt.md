# Remote Log Relay for debug-agent

Build a hosted log relay using Cloudflare Durable Objects so production apps can push NDJSON logs to a public URL and a local Claude Code agent can read them via HTTP GET or SSE stream. This solves the problem that localhost URLs don't work for production debugging.

## What to build

Two changes:

1. **New package `packages/debug-agent-remote`** — A Cloudflare Worker with a SQLite-backed Durable Object that acts as a log relay. Each session auto-expires after 1 hour.
2. **New `remote` command in `packages/debug-agent`** — A CLI subcommand that creates remote sessions, streams logs, and integrates with the existing skill workflow.
3. **Update `packages/debug-agent/skill/SKILL.md`** — Add remote mode instructions so the agent can infer when to use remote vs local.

---

## Part 1: `packages/debug-agent-remote` (Cloudflare Worker)

### Package setup

- npm name: `@debug-agent/remote`
- Add to `pnpm-workspace.yaml` (already covered by `packages/*` glob)
- Use `wrangler` for builds and deployment (not vite-plus — this is a Worker, not a Node library)
- `package.json` with `wrangler` as a dev dependency, `@cloudflare/workers-types` for types
- Compatibility date: `2026-02-24` or later (needed for `deleteAll()` to also delete alarms)
- `wrangler.jsonc` config with a single Durable Object binding

### Durable Object: `LogSession`

SQLite-backed Durable Object class. One instance per debug session.

**On creation (first request):**

- Record `createdAt` timestamp in storage
- Set an alarm for 1 hour from now via `this.ctx.storage.setAlarm(Date.now() + 3_600_000)`
- Create a SQLite table for log entries:
  ```sql
  CREATE TABLE IF NOT EXISTS logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    entry_id TEXT,
    data TEXT NOT NULL,
    created_at INTEGER NOT NULL DEFAULT (unixepoch('subsec') * 1000)
  )
  ```
  (`entry_id` is the optional dedup `id` field from the log payload; `data` is the full JSON string)

**Storage limits (enforce on POST):**

- Max 10,000 log entries per session
- Max 10KB (10,240 bytes) per individual log entry (the JSON string)
- Max 100MB (104,857,600 bytes) total storage per session (sum of all `data` column lengths)
- Return `413 Payload Too Large` with a JSON error body when any limit is exceeded

**Alarm handler (`alarm()`):**

- Call `this.ctx.storage.deleteAll()` — this clears all SQLite data AND the alarm itself (compatibility date 2026-02-24+)
- Close all active SSE connections with an `expired` event before closing
- The Durable Object ceases to exist once storage is empty and it shuts down

**In-memory state:**

- `Set<WritableStreamDefaultWriter>` for active SSE connections (to broadcast new logs)
- `initialized: boolean` flag to track if the SQLite table has been created

### Worker entry point

The Worker routes requests to the appropriate Durable Object.

**Routes:**

| Method    | Path            | Handler                                                                                                    |
| --------- | --------------- | ---------------------------------------------------------------------------------------------------------- |
| `POST`    | `/sessions`     | Create a new session: generate nanoid(21), get DO stub by name, call DO to initialize, return session info |
| `POST`    | `/s/:id`        | Forward to DO — ingest a log entry                                                                         |
| `GET`     | `/s/:id`        | Forward to DO — return all buffered logs as NDJSON                                                         |
| `GET`     | `/s/:id/stream` | Forward to DO — SSE stream                                                                                 |
| `DELETE`  | `/s/:id`        | Forward to DO — clear logs (but keep session alive)                                                        |
| `OPTIONS` | `*`             | CORS preflight                                                                                             |

**CORS headers on ALL responses:**

```
Access-Control-Allow-Origin: *
Access-Control-Allow-Methods: GET, POST, DELETE, OPTIONS
Access-Control-Allow-Headers: Content-Type
```

**Session creation (`POST /sessions`):**

- Generate a nanoid (21 chars, URL-safe alphabet, use `crypto.getRandomValues` — no npm dependency needed)
- Derive the Durable Object ID from the nanoid using `env.LOG_SESSION.idFromName(sessionId)`
- Call the DO to initialize it (POST with empty body or a special init action)
- Return JSON:
  ```json
  {
    "sessionId": "V1StGXR8_Z5jdHi6B-myT",
    "endpoint": "https://<worker-domain>/s/V1StGXR8_Z5jdHi6B-myT",
    "streamUrl": "https://<worker-domain>/s/V1StGXR8_Z5jdHi6B-myT/stream",
    "expiresAt": 1733460389000
  }
  ```

**For all `/s/:id` routes:**

- Parse the session ID from the URL
- Get the DO stub via `env.LOG_SESSION.idFromName(sessionId)`
- Forward the request to the DO
- If the DO's storage is empty (session expired/never existed), return `410 Gone`

### Durable Object request handling

**`POST /s/:id` (ingest):**

- Parse JSON body
- If body has an `id` field, check for duplicates: `SELECT 1 FROM logs WHERE entry_id = ? LIMIT 1`
  - If duplicate, return `{ ok: true, duplicate: true }`
- Add `sessionId` and `timestamp` fields if missing (same as local server)
- Check size limits before inserting
- Insert into SQLite: `INSERT INTO logs (entry_id, data) VALUES (?, ?)`
- Broadcast to all active SSE connections as a `log` event
- Return `{ ok: true }`

**`GET /s/:id` (read all):**

- `SELECT data FROM logs ORDER BY id ASC`
- Concatenate all `data` values with `\n` separator
- Return with `Content-Type: application/x-ndjson`

**`GET /s/:id/stream` (SSE):**

- Return a streaming `Response` with:
  ```
  Content-Type: text/event-stream
  Cache-Control: no-cache
  Connection: keep-alive
  ```
- Immediately send a `connected` event:
  ```
  event: connected
  data: {"sessionId":"...","expiresAt":1733460389000,"bufferedLogs":42}
  ```
- Replay all existing logs as `log` events:
  ```
  event: log
  data: {"sessionId":"a1b2c3","location":"test.js:42",...}
  ```
- Send a `replay-complete` marker:
  ```
  event: replay-complete
  data: {}
  ```
- Keep the connection open. When new logs arrive (via POST), broadcast as `log` events.
- When the alarm fires (session expires), send an `expired` event and close:
  ```
  event: expired
  data: {"reason":"Session expired after 1 hour"}
  ```
- Register the writer in the DO's in-memory SSE connection set. Remove on disconnect.

**`DELETE /s/:id` (clear):**

- `DELETE FROM logs`
- Reset any in-memory dedup tracking
- Return `{ ok: true, cleared: true }`

### nanoid implementation

Implement nanoid inline in the Worker (no npm dependency). Use the standard URL-safe alphabet:

```typescript
const ALPHABET = "useandom-26T198340PX75pxJACKVERYMINDBUSHWOLF_GQZbfghjklqvwyzrict";
const NANOID_LENGTH = 21;

const generateSessionId = (): string => {
  const bytes = crypto.getRandomValues(new Uint8Array(NANOID_LENGTH));
  let id = "";
  for (let i = 0; i < NANOID_LENGTH; i++) {
    id += ALPHABET[bytes[i] & 63];
  }
  return id;
};
```

### File structure

```
packages/debug-agent-remote/
├── package.json
├── tsconfig.json
├── wrangler.jsonc
└── src/
    ├── index.ts          # Worker entry point (routing, CORS, nanoid)
    ├── log-session.ts    # LogSession Durable Object class
    └── constants.ts      # Limits, TTL, alphabet constants
```

### Constants (`src/constants.ts`)

```typescript
export const SESSION_TTL_MS = 3_600_000;
export const MAX_LOG_ENTRIES = 10_000;
export const MAX_ENTRY_SIZE_BYTES = 10_240;
export const MAX_TOTAL_STORAGE_BYTES = 104_857_600;
export const NANOID_LENGTH = 21;
export const NANOID_ALPHABET = "useandom-26T198340PX75pxJACKVERYMINDBUSHWOLF_GQZbfghjklqvwyzrict";
```

---

## Part 2: `remote` command in `packages/debug-agent`

### New command: `src/commands/remote.ts`

Add a `remote` subcommand to the existing CLI in `src/cli.ts`. Follow the exact same patterns as `src/commands/serve.ts`.

**Options:**

- `--url <url>` — Override the Worker URL (default: hardcoded constant)
- `--daemon` — Create session, print JSON info, exit
- `--json` — Create session, start SSE streaming, output NDJSON lines to stdout
- (no flags) — Interactive mode with spinner + pretty output

**Daemon mode (`--daemon`):**

1. POST to `{workerUrl}/sessions` to create a session
2. Print the response JSON to stdout (single line):
   ```json
   {
     "sessionId": "...",
     "endpoint": "https://...",
     "streamUrl": "https://...",
     "expiresAt": 1733460389000
   }
   ```
3. Exit immediately (nothing to background — the Worker is already running)

**JSON mode (`--json`):**

1. Create session (same as daemon)
2. Print session info JSON line
3. Connect to SSE stream at `streamUrl`
4. Pipe each `log` event's data to stdout as a line (NDJSON output)
5. On `expired` event, print `{"event":"expired"}` and exit

**Interactive mode:**

1. Create session with spinner
2. Display session info:
   ```
   ✔ Remote session created (expires in 60 min)
     Endpoint: https://xxx.workers.dev/s/V1StGXR8_Z5jdHi6B-myT
     Stream:   https://xxx.workers.dev/s/V1StGXR8_Z5jdHi6B-myT/stream
   ```
3. Connect to SSE stream
4. Pretty-print each log event as it arrives (timestamp, location, message)
5. Handle Ctrl+C gracefully

**SSE client implementation:**
Use native `fetch()` with streaming response body (no EventSource dependency needed in Node — parse SSE manually from the ReadableStream). Parse `event:` and `data:` lines per the SSE spec.

### Constants update

Add to `packages/debug-agent/src/constants.ts`:

```typescript
export const DEFAULT_REMOTE_URL = "https://debug-agent-remote.<account>.workers.dev";
```

The actual workers.dev subdomain will be determined after first `wrangler deploy`. Use a placeholder that the deployer updates.

### CLI registration

In `src/cli.ts`, add:

```typescript
import { remoteCommand } from "./commands/remote.js";
// ...
.addCommand(remoteCommand)
```

---

## Part 3: Update SKILL.md

Update `packages/debug-agent/skill/SKILL.md` to support both local and remote modes. The key changes:

### Add a mode selection section after "STEP 0"

Before Step 0, add a decision point:

```markdown
### Choosing local vs remote mode

- **Local mode** (default): Use when the buggy code runs on the same machine as this agent (localhost, local dev server, local scripts). Logs stay on disk.
- **Remote mode**: Use when the buggy code runs on a remote server, cloud environment, or production — anywhere that cannot reach `localhost`. Logs are relayed through a hosted service.

If the bug is in code that runs remotely or in production, use remote mode. Otherwise, use local mode.
```

### Update STEP 0 to show both modes

Add a remote variant of Step 0:

```markdown
**Remote mode** — run this instead:

\`\`\`bash
npx debug-agent remote --daemon
\`\`\`

The command prints a single JSON line to stdout and exits:

\`\`\`json
{
"sessionId": "V1StGXR8_Z5jdHi6B-myT",
"endpoint": "https://xxx.workers.dev/s/V1StGXR8_Z5jdHi6B-myT",
"streamUrl": "https://xxx.workers.dev/s/V1StGXR8_Z5jdHi6B-myT/stream",
"expiresAt": 1733460389000
}
\`\`\`

Capture the **endpoint** value. There is no local log file in remote mode.

**Important:** Remote sessions expire after 1 hour. If the session expires mid-debug, create a new one.
```

### Update STEP 2 (instrumentation)

In remote mode, ALL languages (not just JS/TS) must use HTTP POST to the endpoint, since there is no local log file. Add a note:

```markdown
- In **remote mode**, ALL languages must use HTTP POST to the **endpoint** (there is no local log file). Use `fetch`, `curl`, `requests.post`, `http.Post`, or equivalent for your language.
```

### Update STEP 4 (reading logs)

In remote mode, instead of reading the file at logPath, the agent fetches logs via HTTP:

```markdown
- In **remote mode**, fetch logs via HTTP instead of reading a file:
  \`\`\`bash
  curl -s ENDPOINT
  \`\`\`
  This returns the same NDJSON format as the local log file.
```

### Update Server API reference table

Add the remote API:

```markdown
### Remote API (remote mode)

| Method              | Path                                         | Effect |
| ------------------- | -------------------------------------------- | ------ |
| `POST /s/:id`       | Append JSON body as NDJSON log entry         |
| `GET /s/:id`        | Read all buffered log entries as NDJSON      |
| `GET /s/:id/stream` | SSE stream (replays buffered logs then live) |
| `DELETE /s/:id`     | Clear all log entries (session stays alive)  |
```

---

## Technical constraints

- Follow all rules from `CLAUDE.md`: arrow functions, interfaces over types, kebab-case files, SCREAMING_SNAKE_CASE constants with unit suffixes, descriptive variable names, no comments unless the "why" is non-obvious, one utility per file in `utils/`, `Boolean()` over `!!`
- The Worker package uses `wrangler` for builds, NOT vite-plus
- The Worker targets Cloudflare Workers runtime (not Node) — no `node:*` imports in the Worker code
- Use the `@cloudflare/workers-types` package for Worker/DO type definitions
- The `remote` CLI command uses native Node `fetch()` for HTTP calls (available in Node 18+)
- Parse SSE manually from `fetch()` streaming response — do not add an EventSource library
- No new dependencies in `packages/debug-agent` beyond what's already there (commander, ora, picocolors, prompts)
- Run `pnpm check` before committing

## Acceptance criteria

1. `wrangler dev` starts the Worker locally and all endpoints work:
   - `POST /sessions` returns session info with a nanoid session ID
   - `POST /s/{id}` ingests a JSON log entry
   - `GET /s/{id}` returns all logs as NDJSON
   - `GET /s/{id}/stream` returns an SSE stream that replays buffered logs, then streams live logs
   - `DELETE /s/{id}` clears logs
   - Expired sessions return `410 Gone`
2. `npx debug-agent remote --daemon` creates a remote session and prints JSON info
3. `npx debug-agent remote --json` creates a session and streams logs as NDJSON to stdout
4. `npx debug-agent remote` shows an interactive session with pretty-printed logs
5. SKILL.md correctly instructs the agent on when and how to use remote mode
6. Size limits are enforced (10K entries, 10KB/entry, 100MB total)
7. Durable Object self-destructs after 1 hour via alarm
8. Dedup works via the optional `id` field on log entries
9. CORS headers allow cross-origin POST from any origin
10. `pnpm check` passes
