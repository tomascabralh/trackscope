# refboi Ollama Breakdown Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Run the refboi breakdown on a local Ollama model (`llama3.1:8b`) instead of the Anthropic API, streaming token-by-token, with no API key.

**Architecture:** Make the prompt builder provider-neutral (`{ system, user }` strings). A new `lib/ollama/client.ts` POSTs to Ollama's native `/api/chat` (stream:true), parses the newline-delimited JSON, and yields text deltas. The existing route's validate → stream-passthrough → abort skeleton is reused; only the upstream call changes. The Anthropic client + SDK stay in the repo, dormant.

**Tech Stack:** Next.js 16 Route Handler (Node runtime), `fetch` against Ollama (no new deps), vitest.

**Design source:** `docs/plans/2026-05-24-refboi-ollama-breakdown-design.md`

---

## Pre-flight (context the implementer needs)

- Ollama is installed and running locally; `llama3.1:8b` and `llama3.2:3b` are pulled. Confirm with: `curl -s http://127.0.0.1:11434/api/tags`.
- App code uses the `@/` alias; files under `lib/refboi/` and `lib/ollama/` that are vitest-tested use **relative** imports (no `@/`), matching the rest of `lib/`.
- 2 pre-existing-but-now-FIXED essentia type errors no longer occur (a `types/essentia.d.ts` exists). `npx tsc --noEmit` should be clean; `npm run build` should pass.
- House rules: conventional commits with scope (`feat(refboi):`, `refactor(refboi):`); every commit body ends with `Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>`.
- The mm:ss ranges in tests/prompt use an EN-DASH (U+2013), not a hyphen.

---

## Task 1: Provider-neutral prompt builder

Change `buildBreakdownMessages` from the Anthropic `{ system: SystemBlock[]; messages: UserMessage[] }` shape to `{ system: string; user: string }`. The `SYSTEM_PROMPT` text and `mmss()` and the user-message rendering are UNCHANGED — only the wrapper shape and the two now-unused interfaces change.

**Files:**
- Modify: `lib/refboi/breakdown-prompt.ts`
- Modify (test first): `lib/refboi/breakdown-prompt.test.ts`

**Step 1: Update the test to the new shape (this is the failing test)**

Replace the entire `describe(...)` block in `lib/refboi/breakdown-prompt.test.ts` with:

```ts
describe("buildBreakdownMessages", () => {
  it("puts the output contract in the system string", () => {
    const { system } = buildBreakdownMessages(input);
    expect(typeof system).toBe("string");
    expect(system.toLowerCase()).toContain("## overall");
  });

  it("renders sections with mm:ss ranges and band labels in the user string", () => {
    const { user } = buildBreakdownMessages(input);
    expect(user).toContain("128"); // bpm
    expect(user).toContain("F# minor");
    expect(user).toContain("0:00–0:18"); // intro range (en-dash)
    expect(user).toContain("0:18–1:20"); // drop range (en-dash)
    expect(user).toMatch(/drop/i);
  });
});
```

(Leave the `import` line and the `const input: BreakdownInput = {...}` fixture above it unchanged.)

**Step 2: Run it to verify it fails**

Run: `npx vitest run lib/refboi/breakdown-prompt.test.ts`
Expected: FAIL — `system`/`user` are undefined or the wrong type (impl still returns `{ system: SystemBlock[], messages }`).

**Step 3: Change the implementation**

In `lib/refboi/breakdown-prompt.ts`:

(a) DELETE the two now-unused interfaces:
```ts
export interface SystemBlock { ... }   // delete
export interface UserMessage { ... }   // delete
```

(b) ADD a neutral return type (near `BreakdownInput`):
```ts
export interface BreakdownMessages {
  system: string;
  user: string;
}
```

(c) Replace the body's `return { ... }` (keep `header` and `sectionLines` exactly as they are) with:
```ts
  return {
    system: SYSTEM_PROMPT,
    user: [...header, ...sectionLines].join("\n"),
  };
```

(d) Change the function signature return type:
```ts
export function buildBreakdownMessages(input: BreakdownInput): BreakdownMessages {
```

Do NOT touch `SYSTEM_PROMPT`, `mmss`, `header`, or `sectionLines`.

**Step 4: Run tests to verify pass**

Run: `npm test`
Expected: PASS — 4/4 (section-spectra unchanged; breakdown-prompt now green on the new shape).

**Step 5: Commit**

```bash
git add lib/refboi/breakdown-prompt.ts lib/refboi/breakdown-prompt.test.ts
git commit -m "refactor(refboi): provider-neutral breakdown prompt shape"
```

---

## Task 2: Ollama client + NDJSON stream parser (TDD)

**Files:**
- Create: `lib/ollama/client.ts`
- Test: `lib/ollama/client.test.ts`

**Step 1: Write the failing test (parser is the fiddly bit — test it directly)**

```ts
// lib/ollama/client.test.ts
import { describe, it, expect } from "vitest";
import { parseNdjson } from "./client";

function streamOf(chunks: string[]): ReadableStream<Uint8Array> {
  const enc = new TextEncoder();
  let i = 0;
  return new ReadableStream({
    pull(controller) {
      if (i < chunks.length) controller.enqueue(enc.encode(chunks[i++]));
      else controller.close();
    },
  });
}

async function collect(gen: AsyncIterable<string>): Promise<string> {
  let out = "";
  for await (const d of gen) out += d;
  return out;
}

describe("parseNdjson", () => {
  it("yields message.content deltas across newline-delimited JSON", async () => {
    const s = streamOf([
      '{"message":{"content":"Hello "},"done":false}\n',
      '{"message":{"content":"world"},"done":false}\n',
      '{"message":{"content":""},"done":true}\n',
    ]);
    expect(await collect(parseNdjson(s))).toBe("Hello world");
  });

  it("reassembles a JSON object split across two chunks", async () => {
    const s = streamOf([
      '{"message":{"con',
      'tent":"split"},"done":false}\n{"message":{"content":"!"},"done":true}\n',
    ]);
    expect(await collect(parseNdjson(s))).toBe("split!");
  });

  it("ignores empty and malformed lines", async () => {
    const s = streamOf([
      "\n",
      "not json\n",
      '{"message":{"content":"ok"},"done":true}\n',
    ]);
    expect(await collect(parseNdjson(s))).toBe("ok");
  });
});
```

**Step 2: Run it to verify it fails**

Run: `npx vitest run lib/ollama/client.test.ts`
Expected: FAIL — module/`parseNdjson` not found.

**Step 3: Implement the client**

```ts
// lib/ollama/client.ts
const DEFAULT_HOST = "http://127.0.0.1:11434";
const DEFAULT_MODEL = "llama3.1:8b";

/** Thrown when the local Ollama server can't be reached or rejects the request. */
export class OllamaUnavailableError extends Error {}

interface StreamChatOpts {
  system: string;
  user: string;
  model?: string;
  signal?: AbortSignal;
}

/**
 * Opens a streaming chat against the local Ollama server. Awaiting this performs
 * the request and validates the response, so connection/setup failures surface
 * here (before the caller commits a streaming HTTP response). The returned
 * iterable yields assistant text deltas.
 */
export async function streamChat(opts: StreamChatOpts): Promise<AsyncIterable<string>> {
  const host = process.env.OLLAMA_HOST ?? DEFAULT_HOST;
  const model = opts.model ?? process.env.OLLAMA_MODEL ?? DEFAULT_MODEL;

  let res: Response;
  try {
    res = await fetch(`${host}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: opts.system },
          { role: "user", content: opts.user },
        ],
        stream: true,
        options: { temperature: 0.7, num_predict: 1500 },
      }),
      signal: opts.signal,
    });
  } catch (err) {
    throw new OllamaUnavailableError(err instanceof Error ? err.message : "fetch failed");
  }

  if (!res.ok || !res.body) {
    const detail = await res.text().catch(() => "");
    throw new OllamaUnavailableError(`ollama responded ${res.status}: ${detail}`);
  }

  return parseNdjson(res.body);
}

/** Parses Ollama's newline-delimited JSON stream, yielding message.content deltas. */
export async function* parseNdjson(
  body: ReadableStream<Uint8Array>
): AsyncGenerator<string> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let nl: number;
      while ((nl = buffer.indexOf("\n")) !== -1) {
        const line = buffer.slice(0, nl).trim();
        buffer = buffer.slice(nl + 1);
        const delta = extractDelta(line);
        if (delta) yield delta;
      }
    }
    const delta = extractDelta(buffer.trim());
    if (delta) yield delta;
  } finally {
    reader.releaseLock();
  }
}

function extractDelta(line: string): string | null {
  if (!line) return null;
  try {
    const obj = JSON.parse(line) as { message?: { content?: string } };
    return obj.message?.content ?? null;
  } catch {
    return null; // ignore keepalive / malformed lines
  }
}
```

**Step 4: Run tests to verify pass**

Run: `npm test`
Expected: PASS — 7/7 (3 new parser tests + 4 existing).

**Step 5: Commit**

```bash
git add lib/ollama/client.ts lib/ollama/client.test.ts
git commit -m "feat(refboi): local Ollama chat client with NDJSON streaming"
```

---

## Task 3: Swap the route to Ollama

Replace the whole body of `app/api/refboi/breakdown/route.ts`. The `isValid` function is unchanged; remove all Anthropic references; check Ollama availability eagerly so a real 503 is returned before the streaming response commits.

**Files:**
- Modify: `app/api/refboi/breakdown/route.ts`

**Step 1: Replace the file contents**

```ts
import {
  buildBreakdownMessages,
  type BreakdownInput,
} from "@/lib/refboi/breakdown-prompt";
import { streamChat, OllamaUnavailableError } from "@/lib/ollama/client";

export const runtime = "nodejs";

function isValid(body: unknown): body is BreakdownInput {
  if (!body || typeof body !== "object") return false;
  const b = body as Record<string, unknown>;
  return (
    typeof b.bpm === "number" &&
    typeof b.key === "string" &&
    typeof b.lufs === "number" &&
    typeof b.durationS === "number" &&
    Array.isArray(b.sections)
  );
}

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "invalid JSON" }, { status: 400 });
  }
  if (!isValid(body)) {
    return Response.json({ error: "invalid breakdown input" }, { status: 400 });
  }

  const { system, user } = buildBreakdownMessages(body);
  const ac = new AbortController();

  // Performed eagerly: a down/misconfigured Ollama fails here, before we commit
  // the streaming response, so we can still return a clean 503.
  let deltas: AsyncIterable<string>;
  try {
    deltas = await streamChat({ system, user, signal: ac.signal });
  } catch (err) {
    if (err instanceof OllamaUnavailableError) {
      return Response.json({ error: "local model unavailable" }, { status: 503 });
    }
    return Response.json({ error: "breakdown failed" }, { status: 500 });
  }

  const encoder = new TextEncoder();
  const readable = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const delta of deltas) {
          controller.enqueue(encoder.encode(delta));
        }
        controller.close();
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        controller.error(err instanceof Error ? err : new Error("stream failed"));
      }
    },
    // Client disconnected (navigate away / regenerate). Abort the upstream
    // Ollama request so it stops generating.
    cancel() {
      ac.abort();
    },
  });

  return new Response(readable, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
```

**Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors. (`lib/claude/client.ts` and `@anthropic-ai/sdk` remain present but unused — that's intentional, not an error.)

**Step 3: Commit**

```bash
git add app/api/refboi/breakdown/route.ts
git commit -m "feat(refboi): stream breakdown from local Ollama instead of Anthropic"
```

---

## Task 4: UI copy + env example

**Files:**
- Modify: `components/refboi/Breakdown.tsx`
- Modify: `.env.local.example`

**Step 1: Update the 503 copy in `Breakdown.tsx`**

Find:
```ts
        const msg =
          res.status === 503
            ? "breakdowns unavailable in this environment"
            : "breakdown request failed";
```
Replace the 503 string:
```ts
        const msg =
          res.status === 503
            ? "local model unavailable — is Ollama running?"
            : "breakdown request failed";
```

**Step 2: Rewrite `.env.local.example`**

```
# refboi's breakdown runs on a local Ollama model. The defaults below work out
# of the box if Ollama is running on the standard port with llama3.1:8b pulled,
# so this file is optional — set these only to override.
# OLLAMA_HOST=http://127.0.0.1:11434
# OLLAMA_MODEL=llama3.1:8b
```

**Step 3: Type-check, test, build**

Run: `npx tsc --noEmit && npm test && npm run build`
Expected: no type errors; 7/7 tests pass; build succeeds and lists `ƒ /api/refboi/breakdown`.

**Step 4: Commit**

```bash
git add components/refboi/Breakdown.tsx .env.local.example
git commit -m "feat(refboi): point breakdown UI + env docs at local Ollama"
```

---

## Task 5: Live verification (no key needed)

This is the payoff of going local — verify the real thing end-to-end.

**Step 1: Confirm the model is available**

Run: `curl -s http://127.0.0.1:11434/api/tags | grep -o 'llama3.1:8b'`
Expected: prints `llama3.1:8b`. (If missing: `ollama pull llama3.1:8b`.)

**Step 2: Smoke-test the route directly (server-side, streaming)**

Start dev in one shell: `npm run dev`. In another:
```bash
curl -N -X POST http://localhost:3000/api/refboi/breakdown \
  -H 'Content-Type: application/json' \
  -d '{"bpm":128,"key":"F# minor","lufs":-8.2,"durationS":200,"sections":[{"label":"intro","startS":0,"endS":18,"bandsDb":{"sub":-30,"low":-20,"mid":-18,"highMid":-22,"high":-28}},{"label":"drop","startS":18,"endS":80,"bandsDb":{"sub":-6,"low":-5,"mid":-8,"highMid":-10,"high":-12}}]}'
```
Expected: markdown streams in, beginning with a `## Overall` heading, then `## Intro (0:00–0:18)` etc. (Generation on 8b takes a few seconds; `-N` disables curl buffering so you see it stream.)

**Step 3: Verify the down-state**

Temporarily stop Ollama (quit the app / `pkill ollama`), repeat the curl.
Expected: `{"error":"local model unavailable"}` with HTTP 503. Restart Ollama afterward.

**Step 4: Verify in the browser**

Open the refboi page, upload a track, confirm the breakdown streams in below the spectral viz and the regenerate button replays it.

No commit (verification only). Report what the breakdown actually read like — that's the real signal for prompt tuning.

---

## Definition of done

With Ollama up, uploading a track streams a `llama3.1:8b` production-notes breakdown into the page (overall + per-section), regenerate replays, stopping Ollama shows "local model unavailable — is Ollama running?", page still works. `npm test` 7/7, `npm run build` passes.

## Out of scope

Dual-provider runtime switch, removing the Anthropic SDK/client, rate limiting/persistence (W5), matching Sonnet quality.
