# refboi breakdown — local Ollama provider design

Date: 2026-05-24
Status: Approved

## Goal

Run the W3 "production notes" breakdown on a **local Ollama model** instead of the Anthropic API, so the breakdown can be developed and iterated for free, offline, with no API key. The Anthropic path stays in the repo but dormant (Claude remains the intended production model per CLAUDE.md).

## Why

The user has Claude Pro but no Anthropic API key (Pro ≠ API access; the API bills separately). Ollama is already installed and running locally with `llama3.1:8b` and `llama3.2:3b` pulled. A local model unblocks prompt + UX iteration at zero cost and is end-to-end verifiable on this machine.

## Decisions (from brainstorm)

| Decision | Choice |
|---|---|
| Provider | Local Ollama, native `/api/chat` endpoint via `fetch` (no new dependency) |
| Default model | `llama3.1:8b` (override via `OLLAMA_MODEL`; `llama3.2:3b` is the fast option) |
| Host | `OLLAMA_HOST`, default `http://127.0.0.1:11434` |
| Anthropic code | **Keep dormant** — `lib/claude/client.ts` and `@anthropic-ai/sdk` stay installed but unused; re-adding Claude later is a small change |
| Prompt shape | Make `breakdown-prompt.ts` provider-neutral (`{ system, user }` strings). System-prompt TEXT (the IP) is unchanged |
| Scope | Replace the provider only; no dual-provider switch (explicitly out of scope) |

## Non-goals

- Dual-provider runtime switch (Claude-or-Ollama by env) — not now.
- Matching Sonnet 4.6 quality. 8b will read more generic; this is the dev rig, not the shippable voice.
- Removing the Anthropic SDK/client.
- Rate limiting, persistence, auth (still W5).

## Honest tradeoff

`llama3.1:8b` is meaningfully weaker than Sonnet 4.6 at nuanced, anti-generic, domain-specific writing. Good for proving the plumbing, the streaming UX, and the *structure* of the prompt — not for the "shareable breakdown" north star. CLAUDE.md continues to name Claude as the production model.

## Architecture

```
RefboiWorkspace (done) → <Breakdown input> → POST /api/refboi/breakdown
   route: validate body → buildBreakdownMessages({system,user})
        → streamChat() [lib/ollama/client] → fetch Ollama /api/chat (stream)
        → parse NDJSON deltas → ReadableStream<Uint8Array> → client renders markdown
```

Only the upstream call + parsing change. The route's validate → build → stream-passthrough → abort skeleton stays.

### Files

**New**
- `lib/ollama/client.ts` — `streamChat({ system, user, model?, signal? }): AsyncIterable<string>`. POSTs to `${OLLAMA_HOST}/api/chat` with `{ model, messages:[{role:"system",content},{role:"user",content}], stream:true, options:{ temperature:0.7, num_predict:1500 } }`. Parses NDJSON, yields `message.content` deltas, stops at `done:true`. Throws `OllamaUnavailableError` on connection failure or non-ok response.

**Modified**
- `lib/refboi/breakdown-prompt.ts` — return `{ system: string; user: string }` (new `BreakdownMessages` type); drop the Anthropic `SystemBlock`/`UserMessage`/`cache_control` shapes. System and user TEXT unchanged. Update `breakdown-prompt.test.ts` to assert on the string fields.
- `app/api/refboi/breakdown/route.ts` — replace `getAnthropic()`/`anthropic.messages.stream()` with `streamChat()`. 503 now means "Ollama unreachable" (`{ error: "local model unavailable" }`). Keep `isValid`, the `ReadableStream` passthrough, and abort wiring via an `AbortController` whose signal is passed to `streamChat`; `cancel()` aborts it. Remove the `import { getAnthropic }` line.
- `components/refboi/Breakdown.tsx` — 503 copy → "local model unavailable — is Ollama running?".
- `.env.local.example` — replace `ANTHROPIC_API_KEY` doc with optional `OLLAMA_HOST` / `OLLAMA_MODEL` (defaults work with no file).

**Untouched but now dormant**
- `lib/claude/client.ts`, `@anthropic-ai/sdk` — left in place, no longer imported.

### Ollama `/api/chat` streaming protocol

Request body: `{ model, messages, stream: true, options: { temperature, num_predict } }`.
Response: newline-delimited JSON. Each line: `{ "message": { "role":"assistant", "content":"<delta>" }, "done": false }`; terminal line `{ "done": true, ... }`.

Parsing must buffer partial lines across network chunks:
```
buffer = ""
for await chunk: buffer += decode(chunk, {stream:true})
  lines = buffer.split("\n"); buffer = lines.pop()   // keep incomplete tail
  for line in lines: if trimmed → JSON.parse → yield obj.message?.content (if truthy); break on obj.done
flush any complete trailing line after the loop
```

### Error handling

- Connection refused / fetch throws → `OllamaUnavailableError` → route returns 503 `{ error: "local model unavailable" }`.
- Non-ok response (e.g. model not pulled → 404 `{"error":"model ... not found"}`) → also 503 `{ error: "local model unavailable" }`; log the upstream detail server-side, don't leak it.
- Mid-stream error → `controller.error(err)` (as today).
- Client disconnect / regenerate → route `cancel()` aborts the upstream fetch (`AbortController`). Client already aborts its own fetch (W3 fix).

### Testing

- `breakdown-prompt.test.ts` — updated to the `{ system, user }` shape: `system` contains "## Overall"; `user` contains bpm/key/mm:ss ranges. Still pure, no network.
- `section-spectra.test.ts` — unchanged.
- `lib/ollama/client.ts` — unit-test the NDJSON line parser against a synthetic chunked byte stream (including a JSON object split across two chunks) using a fake `fetch`. This is the one genuinely fiddly bit, so it gets a test.
- **Live verification** (no key needed): run a real breakdown through `llama3.1:8b` and confirm it streams token-by-token into the page and that regenerate aborts cleanly.

## Definition of done

With Ollama running, upload a track in Chrome → a production-notes breakdown streams in from `llama3.1:8b` below the spectral viz, overall + per-section. Regenerate replays. Stopping Ollama → inline "local model unavailable — is Ollama running?" message, page still works. `npm test` green; `npm run build` passes.
