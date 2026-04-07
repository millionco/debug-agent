---
name: debug-agent
description: >-
  Systematic evidence-based debugging using runtime logs. Generates hypotheses,
  instruments code with NDJSON logs, guides reproduction, analyzes log evidence,
  and iterates until root cause is proven with cited log lines. Use when the
  user reports a bug, unexpected behavior, or asks to debug an issue.
---

# Debug Mode

You are now in **DEBUG MODE**. You must debug with **runtime evidence**.

**Why this approach:** Traditional AI agents jump to fixes claiming 100% confidence, but fail due to lacking runtime information.
They guess based on code alone. You **cannot** and **must NOT** fix bugs this way — you need actual runtime data.

**Your systematic workflow:**

1. **Generate 3-5 precise hypotheses** about WHY the bug occurs (be detailed, aim for MORE not fewer)
2. **Instrument code** with logs (see Logging section) to test all hypotheses in parallel
3. **Ask user to reproduce** the bug. Provide clear, numbered reproduction steps. Remind the user to restart any apps/services if instrumented files are cached or bundled. Ask the user to confirm when done.
4. **Analyze logs**: evaluate each hypothesis (CONFIRMED/REJECTED/INCONCLUSIVE) with cited log line evidence
5. **Fix only with 100% confidence** and log proof; do NOT remove instrumentation yet
6. **Verify with logs**: ask user to run again, compare before/after logs with cited entries
7. **If logs prove success** and user confirms: remove logs and explain. **If failed**: FIRST remove any code changes from rejected hypotheses (keep only instrumentation and proven fixes), THEN generate NEW hypotheses from different subsystems and add more instrumentation
8. **After confirmed success**: explain the problem and provide a concise summary of the fix (1-2 lines)

**Critical constraints:**

- NEVER fix without runtime evidence first
- ALWAYS rely on runtime information + code (never code alone)
- Do NOT remove instrumentation before post-fix verification logs prove success and user confirms that there are no more issues
- Fixes often fail; iteration is expected and preferred. Taking longer with more data yields better, more precise fixes

---

## Logging

### STEP 0: Start the logging server (MANDATORY BEFORE ANY INSTRUMENTATION)

**CRITICAL: The server is a long-running process. You MUST run it in the BACKGROUND.**

Run the debug server as a **background process** before any instrumentation. The server stays running for the entire debug session — it is NOT a one-shot command.

```bash
npx debug-agent 2>&1 &
```

**YOU MUST BACKGROUND THIS COMMAND.** Do NOT run it in the foreground. Do NOT wait for it to complete — it never completes, it is a persistent server. Use `&` (shell background), `nohup`, or your agent's background/async command execution. If your agent platform supports `block_until_ms: 0` or equivalent, use that. If it supports running commands in a separate terminal, do that. **The command MUST NOT block your workflow.**

The server prints a single JSON line to stdout on startup:

```json
{
  "sessionId": "a1b2c3",
  "port": 54321,
  "endpoint": "http://127.0.0.1:54321/ingest/a1b2c3",
  "logPath": "/tmp/debug-agent/debug-a1b2c3.log"
}
```

Capture and remember these values:

- **Server endpoint**: The `endpoint` value (the HTTP endpoint URL where logs will be sent via POST requests)
- **Log path**: The `logPath` value (NDJSON logs are written here)
- **Session ID**: The `sessionId` value (unique identifier for this debug session)

If the server fails to start, STOP IMMEDIATELY and inform the user.

- DO NOT PROCEED with instrumentation without valid logging configuration.
- The server is idempotent — if one is already running, it returns the existing server's info instead of starting a duplicate.
- You do not need to pre-create the log file; it will be created automatically when your instrumentation first writes to it.

### STEP 1: Understand the log format

- Logs are written in **NDJSON format** (one JSON object per line) to the file specified by the **log path**.
- For JavaScript/TypeScript, logs are sent via a POST request to the **server endpoint** during runtime, and the logging server writes these as NDJSON lines to the **log path** file.
- For other languages (Python, Go, Rust, Java, C/C++, Ruby, etc.), you should prefer writing logs directly by appending NDJSON lines to the **log path** using the language's standard library file I/O.

Example log entry:

```json
{
  "sessionId": "a1b2c3",
  "id": "log_1733456789_abc",
  "timestamp": 1733456789000,
  "location": "test.js:42",
  "message": "User score",
  "data": { "userId": 5, "score": 85 },
  "runId": "run1",
  "hypothesisId": "A"
}
```

### STEP 2: Insert instrumentation logs

- In **JavaScript/TypeScript files**, use this one-line fetch template (replace `ENDPOINT` and `SESSION_ID` with values from Step 0), even if filesystem access is available:

```
fetch('ENDPOINT',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId:'SESSION_ID',location:'file.js:LINE',message:'desc',data:{k:v},timestamp:Date.now()})}).catch(()=>{});
```

- In **non-JavaScript languages** (Python, Go, Rust, Java, C, C++, Ruby), instrument by opening the **log path** in append mode using standard library file I/O, writing a single NDJSON line with your payload, and then closing the file. Keep these snippets as tiny and compact as possible (ideally one line, or just a few).

- Decide how many instrumentation logs to insert based on the complexity of the code under investigation and the hypotheses you are testing. A single well-placed log may be enough when the issue is highly localized; complex multi-step flows may need more. Aim for the minimum number that can confirm or reject ALL your hypotheses. Guidelines:
  - At least 1 log is required; never skip instrumentation entirely
  - Do not exceed 10 logs — if you think you need more, narrow your hypotheses first
  - Typical range is 2-6 logs, but use your judgment

- Choose log placements from these categories as relevant to your hypotheses:
  - Function entry with parameters
  - Function exit with return values
  - Values BEFORE critical operations
  - Values AFTER critical operations
  - Branch execution paths (which if/else executed)
  - Suspected error/edge case values
  - State mutations and intermediate values

- Each log must map to at least one hypothesis (include `hypothesisId` in payload).
- Use this payload structure: `{sessionId, runId, hypothesisId, location, message, data, timestamp}`
- **REQUIRED:** Wrap EACH debug log in a collapsible code region:
  - Use language-appropriate region syntax (e.g., `// #region debug log`, `// #endregion` for JS/TS)
  - This keeps the editor clean by auto-folding debug instrumentation
- **FORBIDDEN:** Logging secrets (tokens, passwords, API keys, PII)

### STEP 3: Clear previous log file before each run (MANDATORY)

- Delete the file at the **log path** before asking the user to run.
- If deleting is unavailable or fails: instruct user to manually delete the log file.
- This ensures clean logs for the new run without mixing old and new data.
- Do NOT use shell commands (rm, touch, etc.); use the delete_file tool only.
- Clearing the log file is NOT the same as removing instrumentation; do not remove any debug logs from code here.
- **CRITICAL:** Only delete YOUR log file (the one at the log path from Step 0). NEVER delete, modify, or overwrite log files belonging to other debug sessions. Other sessions may have log files in the same directory with different session IDs in their filenames — leave them untouched.

### STEP 4: Read logs after user runs the program

- After the user runs the program and confirms completion in their interface, do NOT ask them to type "done"; then read the file at the **log path**.
- The log file will contain NDJSON entries (one JSON object per line) from your instrumentation.
- Analyze these logs to evaluate your hypotheses and identify the root cause.
- If log file is empty or missing: tell user the reproduction may have failed and ask them to try again.

### STEP 5: Keep logs during fixes

- When implementing a fix, DO NOT remove debug logs yet.
- Logs MUST remain active for verification runs.
- You may tag logs with `runId="post-fix"` to distinguish verification runs from initial debugging runs.
- FORBIDDEN: Removing or modifying any previously added logs in any files before post-fix verification logs are analyzed or the user explicitly confirms success.
- Only remove logs after a successful post-fix verification run (log-based proof) or explicit user request to remove.

---

## Critical Reminders (must follow)

- Keep instrumentation active during fixes; do not remove or modify logs until verification succeeds or the user explicitly confirms.
- FORBIDDEN: Using `setTimeout`, `sleep`, or artificial delays as a "fix"; use proper reactivity/events/lifecycles.
- FORBIDDEN: Removing instrumentation before analyzing post-fix verification logs or receiving explicit user confirmation.
- Verification requires before/after log comparison with cited log lines; do not claim success without log proof.
- Do not create the log file manually; it's created automatically.
- Clearing the log file is not removing instrumentation.
- NEVER delete or modify log files that do not belong to this session. Only touch the log file at the exact path from Step 0.
- Always try to rely on generating new hypotheses and using evidence from the logs to provide fixes.
- If all hypotheses are rejected, you MUST generate more and add more instrumentation accordingly.
- **Remove code changes from rejected hypotheses:** When logs prove a hypothesis wrong, revert the code changes made for that hypothesis. Do not let defensive guards, speculative fixes, or unproven changes accumulate. Only keep modifications that are supported by runtime evidence.
- Prefer reusing existing architecture, patterns, and utilities; avoid overengineering. Make fixes precise, targeted, and as small as possible while maximizing impact.

## Server API reference

| Method                      | Effect                                      |
| --------------------------- | ------------------------------------------- |
| `POST /ingest/:sessionId`   | Append JSON body as NDJSON line to log file |
| `GET /ingest/:sessionId`    | Read full log file contents                 |
| `DELETE /ingest/:sessionId` | Clear the log file                          |
