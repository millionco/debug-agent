# Debug Agent

**Debug Agent** is a skill that teaches AI coding agents to debug with runtime evidence instead of guessing.

## Getting Started

```bash
npx debug-agent@latest init
```

This installs the `debug-mode` skill for all detected agents (Cursor, Claude Code, Codex, etc.). When your agent encounters a bug, it will:

1. Generate hypotheses about the root cause
2. Instrument your code with lightweight NDJSON logs
3. Ask you to reproduce the bug
4. Analyze the logs to confirm or reject each hypothesis
5. Fix only with 100% confidence backed by log evidence
6. Verify the fix with before/after log comparison

## How It Works

Traditional AI agents jump to fixes by guessing from code alone. Debug Agent forces an evidence-based workflow:

```
Hypothesize → Instrument → Reproduce → Analyze → Fix → Verify
```

The agent runs a zero-dependency logging server (`npx debug-agent`) that collects structured NDJSON log entries via HTTP. Instrumentation is a single `fetch()` call per log point — no SDKs, no setup, no dependencies in your project.

## CLI

```bash
npx debug-agent              # start the logging server (default command)
npx debug-agent init         # install the skill for detected agents
npx debug-agent init --list  # show available agents
```

### Server Options

| Flag                    | Description       | Default                         |
| ----------------------- | ----------------- | ------------------------------- |
| `-p, --port <number>`   | Port to listen on | random                          |
| `-H, --host <address>`  | Host to bind to   | `127.0.0.1`                     |
| `-s, --session-id <id>` | Session ID        | random 6-char                   |
| `-l, --log-path <path>` | Log file path     | `.agents/debug-<sessionId>.log` |

### Init Options

| Flag                     | Description                             | Default       |
| ------------------------ | --------------------------------------- | ------------- |
| `-g, --global`           | Install globally instead of per-project | project-level |
| `-a, --agent <names...>` | Target specific agents                  | auto-detect   |
| `--copy`                 | Copy files instead of symlinking        | symlink       |
| `--list`                 | List available agents and exit          | -             |

## Supported Agents

Debug Agent auto-detects which agents are installed and creates the appropriate skill directories and symlinks.

| Agent                                                         | Skills Directory    |
| ------------------------------------------------------------- | ------------------- |
| [Cursor](https://cursor.com)                                  | `.agents/skills/`   |
| [Claude Code](https://docs.anthropic.com/en/docs/claude-code) | `.claude/skills/`   |
| [Codex](https://github.com/openai/codex)                      | `.agents/skills/`   |
| [GitHub Copilot](https://github.com/features/copilot)         | `.agents/skills/`   |
| [Gemini CLI](https://github.com/google-gemini/gemini-cli)     | `.agents/skills/`   |
| [Windsurf](https://windsurf.com)                              | `.windsurf/skills/` |
| [Amp](https://amp.dev)                                        | `.agents/skills/`   |
| [OpenCode](https://opencode.ai)                               | `.agents/skills/`   |
| [Goose](https://block.github.io/goose)                        | `.goose/skills/`    |
| [Roo Code](https://roo.dev)                                   | `.roo/skills/`      |

Agents using `.agents/skills/` share the canonical directory — no symlinks needed. Non-universal agents (Claude Code, Windsurf, Goose, Roo) get a relative symlink pointing back to the canonical copy.

## Programmatic Usage

```typescript
import { createServer } from "debug-agent";

const { server, info } = await createServer({ port: 8080 });
console.log(info.endpoint); // http://127.0.0.1:8080/ingest/<sessionId>

// POST JSON to info.endpoint to log
// GET info.endpoint to read logs
// DELETE info.endpoint to clear logs

server.close();
```

## License

MIT © Million Software, Inc.
