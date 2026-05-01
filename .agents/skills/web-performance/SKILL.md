---
name: web-performance
description: >-
  Use when the user reports jank, dropped frames, janky scrolling, slow click
  or typing response, poor INP, slow LCP, layout shifts (CLS), unresponsive
  pages, or asks to debug rendering, animation, or interaction performance in
  a browser app.
---

# Web Performance

## Overview

Browser performance debugging via `PerformanceObserver`, with **LoAF (`long-animation-frame`) as the primary signal**. LoAF is the only entry type that, in one record, attributes a slow frame to a specific `sourceURL` + `sourceFunctionName` + `sourceCharPosition` + `invokerType`, with per-script `forcedStyleAndLayoutDuration` (sync reflow), `pauseDuration` (sync XHR / `alert`), and `blockingDuration`. Code inspection and `performance.now()` cannot reach this. **Start with LoAFs, conclude from LoAFs.**

## When to use

Symptoms:

- Jank, dropped frames, janky scroll/swipe, complaints about frame rate
- Slow click / keypress / touch response, "unresponsive" complaints, poor INP
- Slow LCP, layout shifts (CLS)
- Animation stutter, transition jank, expensive renders during interaction

**Do NOT use for:**

- Backend / non-browser perf — use raw NDJSON file appends from your server runtime
- Memory leaks, bundle-size regressions — heap snapshots / bundle analyzers
- Logic bugs unrelated to timing — use raw fetch instrumentation

## Core pattern

**Before — manual `performance.now()` (wrong):**

```js
const t0 = performance.now();
drawSeries(data);
console.log("drawSeries took", performance.now() - t0);
```

Tells you a number. Doesn't tell you the function caused a long frame, what scheduled it, or whether it forced sync layout. Requires you to _already suspect_ `drawSeries`.

**After — LoAF observer (right):**

```js
new PerformanceObserver((list) => {
  for (const loaf of list.getEntries()) send(loaf);
}).observe({ type: "long-animation-frame", buffered: true });
```

Reports every frame `> 50ms` across the whole page, with `scripts[].sourceURL` + `sourceFunctionName` + `sourceCharPosition` + `invokerType` + `forcedStyleAndLayoutDuration` for each script that ran in the frame. **You don't need to know where the bug is in advance.**

## Workflow

1. Generate 3-5 hypotheses about what's slow and where.
2. Start the logging server (Implementation → STEP 0).
3. Inject the LoAF observer as the first script in `<head>` or top of SPA entry.
4. Reproduce — automate via Playwright/Puppeteer if possible; otherwise give numbered steps and ask the user to confirm in their UI (do NOT ask them to type "done").
5. Clear the log file before each run via the deletion tool (NOT `rm`).
6. Analyze LoAFs first; consult secondary signals only if LoAF is silent. Mark hypotheses CONFIRMED / REJECTED / INCONCLUSIVE with cited entries.
7. Fix only with 100% confidence. Keep instrumentation in place; tag post-fix runs with `runId="post-fix"`.
8. Verify by re-running and comparing before/after LoAFs with cited lines. If failed, revert rejected-hypothesis code (keep instrumentation), generate new hypotheses, iterate.
9. Cleanup — remove the `#region debug log` block only after verified success + explicit user confirmation.

## Implementation

### STEP 0: Start the logging server (background-only)

```bash
npx debug-agent@latest --json --daemon
```

`--daemon` forks the server into a detached process and exits immediately (your shell unblocks instantly — no need for `&`/`nohup`). `--json` makes the parent emit one machine-readable JSON line (without it you get a colored spinner). It prints one JSON line on startup:

```json
{
  "sessionId": "a1b2c3",
  "endpoint": "http://127.0.0.1:54321/ingest/a1b2c3",
  "logPath": "/tmp/debug-agent/debug-a1b2c3.log"
}
```

Capture `endpoint` (POST traces here), `logPath` (NDJSON written here on macOS at `/var/folders/.../T/debug-agent/debug-<sessionId>.log`), `sessionId` (in every payload). The log file is auto-created on first write — do NOT pre-create. **Server is idempotent**: re-running `--json --daemon` returns the same `sessionId`/`port`/`logPath` of the existing server, so it's safe to call at the start of every session. If startup fails, STOP and inform the user.

To clear the log file via HTTP without deleting/recreating it: `curl -X DELETE <endpoint>` returns `{"ok":true,"cleared":true}`.

### STEP 1: Inject the LoAF observer

Replace `__ENDPOINT__` and `__SESSION_ID__`. Paste **once** as the very first script in `<head>` (above framework bootstrap), or top of the SPA entry module (`main.tsx`, `index.ts`, `app.tsx`). One IIFE in one `#region debug log` block.

```html
<script>
  // #region debug log
  (() => {
    const ENDPOINT = "__ENDPOINT__";
    const SESSION_ID = "__SESSION_ID__";
    const send = (kind, payload) =>
      fetch(ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: SESSION_ID,
          location: "PerformanceObserver:" + kind,
          message: kind,
          data: payload,
          timestamp: Date.now(),
        }),
        keepalive: true,
      }).catch(() => {});
    const observe = (type, mapEntry) => {
      try {
        new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) send(type, mapEntry(entry));
        }).observe({ type, buffered: true });
      } catch {}
    };
    observe("long-animation-frame", (loaf) => ({
      startTime: loaf.startTime,
      duration: loaf.duration,
      renderStart: loaf.renderStart,
      styleAndLayoutStart: loaf.styleAndLayoutStart,
      blockingDuration: loaf.blockingDuration,
      firstUIEventTimestamp: loaf.firstUIEventTimestamp,
      scripts: (loaf.scripts || []).map((scriptTiming) => ({
        invoker: scriptTiming.invoker,
        invokerType: scriptTiming.invokerType,
        sourceURL: scriptTiming.sourceURL,
        sourceFunctionName: scriptTiming.sourceFunctionName,
        sourceCharPosition: scriptTiming.sourceCharPosition,
        executionStart: scriptTiming.executionStart,
        duration: scriptTiming.duration,
        forcedStyleAndLayoutDuration: scriptTiming.forcedStyleAndLayoutDuration,
        pauseDuration: scriptTiming.pauseDuration,
      })),
    }));
  })();
  // #endregion
</script>
```

`buffered: true` and `keepalive: true` are required (early entries + survival across navigation). The `try/catch` lets the observer no-op on browsers without LoAF support.

**FORBIDDEN:** logging DOM text, form values, cookies, tokens, PII-bearing URLs — emit only tag names, URLs, durations, rects.

### Secondary observers (add inside the same IIFE only when LoAF can't see it)

| Add this observer          | When                                                               |
| -------------------------- | ------------------------------------------------------------------ |
| `event`                    | INP investigation (input delay / handler / presentation breakdown) |
| `layout-shift`             | CLS investigation                                                  |
| `largest-contentful-paint` | Slow LCP investigation                                             |
| `longtask`                 | Safari/Firefox fallback (no script attribution)                    |
| `paint`                    | First Paint / FCP investigation                                    |

```js
observe("event", (e) => ({
  name: e.name,
  startTime: e.startTime,
  duration: e.duration,
  processingStart: e.processingStart,
  processingEnd: e.processingEnd,
  interactionId: e.interactionId,
  targetTag: e.target?.tagName ?? null,
}));
observe("layout-shift", (s) => ({
  startTime: s.startTime,
  value: s.value,
  hadRecentInput: s.hadRecentInput,
  sources: (s.sources || []).map((x) => ({
    nodeName: x.node?.nodeName ?? null,
    previousRect: x.previousRect,
    currentRect: x.currentRect,
  })),
}));
observe("largest-contentful-paint", (p) => ({
  startTime: p.startTime,
  renderTime: p.renderTime,
  loadTime: p.loadTime,
  size: p.size,
  url: p.url,
  elementTag: p.element?.tagName ?? null,
}));
observe("longtask", (t) => ({
  startTime: t.startTime,
  duration: t.duration,
  attribution: (t.attribution || []).map((a) => ({
    name: a.name,
    containerType: a.containerType,
    containerSrc: a.containerSrc,
  })),
}));
observe("paint", (p) => ({ name: p.name, startTime: p.startTime }));
```

### STEPs 2-5: Log lifecycle

- **Clear** `logPath` before each run. Two equivalent options: file-deletion tool (NOT `rm`) on the path, or `curl -X DELETE <endpoint>`. Only your session's file — never another session's. Clearing ≠ removing instrumentation.
- **Read** `logPath` after the user confirms reproduction. Each line is `{ sessionId, id, timestamp, location, message, data }`. Empty/missing → reproduction failed; clear and retry.
- **Keep** all instrumentation through fixes. Tag verification runs with `runId="post-fix"`. Removing logs before verification is FORBIDDEN.
- **Cleanup** after verified success + user confirmation: grep `#region debug log`, delete each region (line-inclusive, including the wrapping `<script>` if injected via HTML), re-grep to confirm zero markers, `git diff` review.

## Quick reference: decoding LoAF entries

Sort entries by `duration` (or `blockingDuration` for input-blocking jank), worst first. **The script with the largest `duration` inside the worst LoAF's `scripts[]` is your culprit.** If `forcedStyleAndLayoutDuration > 10ms` or `> 25%` of script duration, it's layout thrashing — look for sync `offsetHeight` / `getBoundingClientRect` / `scrollTop` reads interleaved with DOM writes.

| Field                                                               | Meaning                                                                                                                                                                                                     | Diagnostic use                                |
| ------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------- |
| `duration`                                                          | total frame time (ms), only fires `> 50ms`                                                                                                                                                                  | severity                                      |
| `blockingDuration`                                                  | input-blocking portion                                                                                                                                                                                      | INP impact                                    |
| `renderStart − startTime`                                           | JS work before render                                                                                                                                                                                       | "long script" share                           |
| `styleAndLayoutStart − renderStart`                                 | rAF / ResizeObserver / IntersectionObserver callbacks                                                                                                                                                       | pre-paint callback cost                       |
| `(startTime + duration) − styleAndLayoutStart`                      | style + layout + paint                                                                                                                                                                                      | CSS / layout cost                             |
| `scripts[].sourceURL` + `sourceFunctionName` + `sourceCharPosition` | exact code site                                                                                                                                                                                             | culprit                                       |
| `scripts[].invoker`                                                 | precise scheduler (e.g. `BUTTON#btn-foo.onclick`, `TimerHandler:setTimeout`, `IMG#hero.onload`)                                                                                                             | which DOM node / timer / promise scheduled it |
| `scripts[].invokerType`                                             | category — `event-listener` / `user-callback` (covers `setTimeout`/`setInterval`/`requestAnimationFrame`/`requestIdleCallback`) / `resolve-promise` / `reject-promise` / `classic-script` / `module-script` | how it ran                                    |
| `scripts[].forcedStyleAndLayoutDuration`                            | sync reflow inside the script                                                                                                                                                                               | layout thrashing                              |
| `scripts[].pauseDuration`                                           | sync XHR / `alert` time                                                                                                                                                                                     | hard blocks                                   |

**`invoker` vs `invokerType`:** `invokerType` is a fixed-vocabulary category; `invoker` is the precise instance. Use `invoker` to tell `setTimeout` from `requestAnimationFrame` (both are `user-callback`), or to identify _which_ button's click handler ran (e.g. `BUTTON#btn-thrash.onclick`).

**Validated thrash fingerprint:** when `forcedStyleAndLayoutDuration / scripts[].duration > 0.5`, the script is dominated by sync layout — almost always reads of `offsetHeight` / `getBoundingClientRect` / `scrollTop` / `getComputedStyle` interleaved with style/DOM writes. Example seen in practice: `duration=252ms`, `forcedStyleAndLayoutDuration=247ms` (98%) for a 1500-iteration read/write loop.

**Cite the specific entry when concluding:**

> CONFIRMED hypothesis B: LoAF `startTime=12483ms`, `duration=128ms`, `scripts[2]`: `sourceURL=https://app.com/static/chart.bundle.js`, `sourceFunctionName=drawSeries`, `invokerType=event-listener`, `duration=84ms`, `forcedStyleAndLayoutDuration=42ms` — chart redraw triggers sync layout in scroll handler.

**Secondary signal decoding (only when LoAF is silent):**

- **`event`** — input delay = `processingStart − startTime`; handler = `processingEnd − processingStart`; presentation = `(startTime + duration) − processingEnd`; `> 200ms` is poor INP. **Filter out noise:** a single click emits 10+ entries (`pointerover`, `pointerenter`, `pointerdown`, `mousedown`, `pointerup`, `mouseup`, `click`, `mouseover`, `pointerout`, `mouseout`, …). Most have `interactionId: 0` (not real interactions) and share the _same_ `duration` (they were all queued behind the same long task). **Only entries with `interactionId !== 0` represent distinct interactions for INP purposes** — and within those, `name === "click"` (or `keydown`/`pointerdown`) is the canonical one.
- **`layout-shift`** — CLS = sum of `value` where `hadRecentInput === false`; `sources[]` pinpoints node + rects.
- **`longtask`** — `> 50ms` main-thread tasks; `attribution[0].containerSrc` often points at a third-party script. Coarser than LoAF; no `sourceFunctionName`.

## Common mistakes

| Mistake                                            | Why it fails                                                                       | Fix                                                                                        |
| -------------------------------------------------- | ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| Snippet pasted _after_ framework bootstrap         | Misses early LoAFs and pre-bootstrap LCP                                           | First `<script>` in `<head>` or top of entry module before any side-effecting `import`     |
| Forgetting `buffered: true`                        | Drops entries that fired before observation started                                | Always `{ type, buffered: true }`                                                          |
| Logging server in foreground                       | Stalls the agent forever                                                           | Use `&` / `nohup` / `block_until_ms: 0`                                                    |
| Manual `fetch` logs alongside the observer         | Pollutes traces, breaks one-region cleanup                                         | Use only the IIFE; add observers, not separate logs                                        |
| Concluding from `duration` only                    | Ignores attribution; you'll guess wrong                                            | Cite `scripts[].sourceURL` + `sourceFunctionName` + `forcedStyleAndLayoutDuration`         |
| Counting every `event` entry as a real interaction | One click emits 10+ entries (pointer*, mouse*, click); most are not "interactions" | Filter `interactionId !== 0`; usually the `click`/`keydown`/`pointerdown` row is canonical |
| Reading `invokerType` and stopping there           | `setTimeout`, `setInterval`, `rAF`, `rIC` all share `invokerType=user-callback`    | Use `invoker` (e.g. `TimerHandler:setTimeout`) to disambiguate                             |
| "Fix" by wrapping in `setTimeout`                  | Defers work; jank just shifts to a later frame                                     | Verify post-fix LoAFs show the script duration is _gone_, not relocated                    |
| Reading bundled `sourceURL` literally              | Minified path is meaningless                                                       | Resolve via sourcemap; `sourceCharPosition` disambiguates collisions                       |
| Testing on Safari/Firefox first                    | LoAF is Chromium-only; you'll think the snippet is broken                          | Reproduce on Chrome/Edge ≥ 123 first                                                       |
| Removing instrumentation before verification       | Can't prove fix worked; no traces if it regressed                                  | Keep `#region debug log` until verified + user confirms                                    |
| Deleting another session's log file                | Corrupts an unrelated debug session                                                | Only touch the `logPath` from YOUR STEP 0                                                  |

## Red flags — STOP and re-instrument

- "I'll just `setTimeout(..., 0)` and call it fixed" → prove the script work is _gone_, not deferred
- "The `duration` looks fine, must be CSS" → check `forcedStyleAndLayoutDuration` and `styleAndLayoutStart` first
- "No LoAF entries appeared" → wrong browser, snippet too late, or no frame `> 50ms`
- "All hypotheses rejected" → never fix without runtime evidence; generate new hypotheses
- "I'll claim success based on the manual fix" → no, cite before/after LoAF lines
