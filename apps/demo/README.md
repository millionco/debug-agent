# Stale Closure Demo

A minimal chat app with a subtle stale closure bug — built to demonstrate [Debug Agent](https://github.com/millionco/debug-agent).

## The Bug

The **Send button** and **Enter key** work perfectly. But the **⌘/Ctrl+Enter** keyboard shortcut silently sends the wrong message (or nothing at all).

The root cause is non-obvious from reading the code alone — it requires runtime evidence to diagnose.

## Setup

```bash
pnpm install
pnpm --filter @debug-agent/demo dev
```

## Reproduce

1. Open `http://localhost:5173`
2. Type "hello" and click **Send** → works fine
3. Type "goodbye" and press **⌘+Enter** (or **Ctrl+Enter**) → sends a blank/wrong message

## Debug with Debug Agent

```bash
npx debug-agent@latest init
```

Then ask your agent to debug: _"The ⌘+Enter shortcut sends the wrong message or nothing"_
