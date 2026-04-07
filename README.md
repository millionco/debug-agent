# Debug Agent

Debug Agent teaches your agent to debug with runtime evidence, not guesswork.

## Getting Started

```bash
npx debug-agent@latest init
```

This installs the `debug` skill for all detected agents (Cursor, Claude Code, Codex, etc.). When your agent encounters a bug, it will:

1. Generate hypotheses about the root cause
2. Instrument your code with lightweight NDJSON logs
3. Ask you to reproduce the bug
4. Analyze the logs to confirm or reject each hypothesis
5. Fix only with 100% confidence backed by log evidence

## Supported Agents

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

## License

MIT © Million Software, Inc.
