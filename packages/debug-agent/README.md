# debug-agent

Zero-dependency NDJSON logging server for evidence-based AI debugging.

## Quick start

```bash
npx debug-agent
```

Prints a single JSON line on startup:

```json
{
  "sessionId": "a1b2c3",
  "port": 54321,
  "endpoint": "http://127.0.0.1:54321/ingest/a1b2c3",
  "logPath": "/abs/path/.agents/debug-a1b2c3.log"
}
```

## CLI options

```
-p, --port <n>         Port to listen on (default: random)
-h, --host <addr>      Host to bind to (default: 127.0.0.1)
-s, --session-id <id>  Session ID (default: random 6-char hex)
-l, --log-path <path>  Log file path (default: .agents/debug-<sessionId>.log)
    --help             Show help
```

## API

### `POST /ingest/:sessionId`

Append a JSON log entry to the NDJSON log file.

```bash
curl -X POST http://127.0.0.1:54321/ingest/a1b2c3 \
  -H "Content-Type: application/json" \
  -d '{"location":"app.js:42","message":"value check","data":{"x":10}}'
```

### `GET /ingest/:sessionId`

Read the full log file.

### `DELETE /ingest/:sessionId`

Clear the log file.

## Programmatic usage

```javascript
import { createServer } from "debug-agent";

const { server, info } = await createServer({ port: 8080 });
console.log(info.endpoint);

// later
server.close();
```

## License

MIT
