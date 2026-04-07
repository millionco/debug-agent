# Debug Agent

Debug Agent teaches your agent to debug with runtime evidence, not guesswork.

## Getting Started

```bash
npx debug-agent@latest init
```

This installs the `debug-agent` skill for all detected agents (Cursor, Claude Code, Codex, etc.).

In Claude Code / Codex, run `/debug [describe your issue]`. In Cursor, ask the agent to "use the debug skill" and describe the issue.

## How it works

1. Run `/debug` inside Claude Code, Codex, and more
2. Generates hypotheses and instruments your code with lightweight NDJSON logs
3. Asks you to reproduce the bug, then analyzes logs to confirm or reject hypotheses
4. Fixes only with 100% confidence backed by log evidence, then verifies

## License

MIT © Million Software, Inc.
