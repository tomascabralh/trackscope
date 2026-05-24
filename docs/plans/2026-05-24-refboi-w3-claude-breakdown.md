# refboi W3 — Claude Breakdown Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** After audio analysis finishes, stream a Claude-generated "production notes" breakdown (overall summary + per-section commentary) into the refboi workspace below the spectral viz.

**Architecture:** A new client component (`Breakdown.tsx`) mounts when `RefboiWorkspace` analysis hits `done`, derives a compact `BreakdownInput` from the `AnalysisResult` via two pure helpers, and POSTs it to a Node-runtime Route Handler. The handler builds cached system + per-track user messages and proxies the Anthropic SDK's token stream back as raw UTF-8 chunks; the client accumulates and renders them as markdown.

**Tech Stack:** Next.js 16 (App Router, Route Handlers), `@anthropic-ai/sdk` (Claude Sonnet 4.6, prompt caching), `react-markdown`, vitest for the pure-helper unit tests.

**Design source:** `docs/superpowers/specs/2026-05-17-refboi-w3-claude-breakdown-design.md`

---

## Decisions locked before coding (deltas from the design doc)

- **`Section` shape:** the real type is `{ start, end, label }` (not `startS`/`endS`). The new `SectionWithSpectra` keeps `startS`/`endS` for clarity at the prompt boundary; helpers map `start→startS`, `end→endS`.
- **Bands are linear RMS** (`Float32Array` per band). Per-section value = mean of the linear RMS across the section's frames, then `20*log10(mean + 1e-9)`, rounded to 1 dp.
- **No test runner exists** → add vitest (Task 0). Pure helpers are TDD'd; route + component are manually verified (per the design's testing approach).
- **Imports inside `lib/refboi/` use relative paths** (`../audio/types`), matching the rest of `lib/`, so vitest needs no `@/` alias config.
- **Model:** `claude-sonnet-4-6`.

---

## Task 0: Tooling — deps + test runner

**Files:**
- Modify: `package.json`
- Create: `.env.local.example`

**Step 1: Install runtime + dev deps**

```bash
npm install @anthropic-ai/sdk react-markdown
npm install -D vitest
```

**Step 2: Add the test script**

In `package.json` `"scripts"`, add:

```json
"test": "vitest run",
"test:watch": "vitest"
```

**Step 3: Document the API key**

Create `.env.local.example`:

```
# refboi W3 — Claude breakdown. Without this, /api/refboi/breakdown returns 503.
ANTHROPIC_API_KEY=sk-ant-...
```

**Step 4: Verify vitest runs (no tests yet = exit 0 with "no test files")**

Run: `npx vitest run`
Expected: exits without error (reports no test files found).

**Step 5: Commit**

```bash
git add package.json package-lock.json .env.local.example
git commit -m "chore(refboi): add anthropic-sdk, react-markdown, vitest for W3"
```

---

## Task 1: `sectionsWithSpectra` helper (TDD)

Computes per-section band averages in dB. Pure function, no audio decode needed.

**Files:**
- Create: `lib/refboi/section-spectra.ts`
- Test: `lib/refboi/section-spectra.test.ts`

**Step 1: Write the failing test**

```ts
// lib/refboi/section-spectra.test.ts
import { describe, it, expect } from "vitest";
import { sectionsWithSpectra } from "./section-spectra";
import type { FeatureFrames, Section } from "../audio/types";

function frames(times: number[], band: number[]): FeatureFrames {
  const f = (a: number[]) => Float32Array.from(a);
  return {
    frameSize: 2048,
    hopSize: 1024,
    hopSeconds: 1,
    times: f(times),
    rms: f(band),
    bands: { sub: f(band), low: f(band), mid: f(band), highMid: f(band), high: f(band) },
  };
}

describe("sectionsWithSpectra", () => {
  it("averages linear RMS per section, then converts to dB", () => {
    // two 2-frame sections; band value 1.0 → 0 dB, 0.1 → -20 dB
    const features = frames([0, 1, 2, 3], [1, 1, 0.1, 0.1]);
    const sections: Section[] = [
      { start: 0, end: 2, label: "intro" },
      { start: 2, end: 4, label: "drop" },
    ];
    const out = sectionsWithSpectra(sections, features);
    expect(out).toHaveLength(2);
    expect(out[0]).toMatchObject({ label: "intro", startS: 0, endS: 2 });
    expect(out[0].bandsDb.sub).toBeCloseTo(0, 1);
    expect(out[1].bandsDb.sub).toBeCloseTo(-20, 1);
  });

  it("handles a section with no frames without NaN", () => {
    const features = frames([0, 1], [1, 1]);
    const sections: Section[] = [{ start: 5, end: 9, label: "outro" }];
    const out = sectionsWithSpectra(sections, features);
    expect(Number.isFinite(out[0].bandsDb.sub)).toBe(true);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run lib/refboi/section-spectra.test.ts`
Expected: FAIL — `sectionsWithSpectra is not a function` / module not found.

**Step 3: Write minimal implementation**

```ts
// lib/refboi/section-spectra.ts
import type { FeatureFrames, Section, SectionLabel } from "../audio/types";

export interface SectionWithSpectra {
  label: SectionLabel;
  startS: number;
  endS: number;
  bandsDb: { sub: number; low: number; mid: number; highMid: number; high: number };
}

const BANDS = ["sub", "low", "mid", "highMid", "high"] as const;
const EPS = 1e-9;

const toDb = (linear: number) => Math.round(20 * Math.log10(linear + EPS) * 10) / 10;

export function sectionsWithSpectra(
  sections: Section[],
  features: FeatureFrames
): SectionWithSpectra[] {
  const { times, bands } = features;
  return sections.map((s) => {
    const idx: number[] = [];
    for (let i = 0; i < times.length; i++) {
      if (times[i] >= s.start && times[i] < s.end) idx.push(i);
    }
    const meanDb = (arr: Float32Array) =>
      idx.length === 0
        ? toDb(0)
        : toDb(idx.reduce((sum, i) => sum + arr[i], 0) / idx.length);
    const bandsDb = Object.fromEntries(
      BANDS.map((b) => [b, meanDb(bands[b])])
    ) as SectionWithSpectra["bandsDb"];
    return { label: s.label, startS: s.start, endS: s.end, bandsDb };
  });
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run lib/refboi/section-spectra.test.ts`
Expected: PASS (2 tests).

**Step 5: Commit**

```bash
git add lib/refboi/section-spectra.ts lib/refboi/section-spectra.test.ts
git commit -m "feat(refboi): per-section spectral band averaging in dB"
```

---

## Task 2: `breakdown-prompt` builder (TDD)

Builds the cached system block + the per-track user message from `BreakdownInput`.

**Files:**
- Create: `lib/refboi/breakdown-prompt.ts`
- Test: `lib/refboi/breakdown-prompt.test.ts`

**Step 1: Write the failing test**

```ts
// lib/refboi/breakdown-prompt.test.ts
import { describe, it, expect } from "vitest";
import { buildBreakdownMessages, type BreakdownInput } from "./breakdown-prompt";

const input: BreakdownInput = {
  bpm: 128,
  key: "F# minor",
  lufs: -8.2,
  durationS: 200,
  sections: [
    { label: "intro", startS: 0, endS: 18, bandsDb: { sub: -30, low: -20, mid: -18, highMid: -22, high: -28 } },
    { label: "drop", startS: 18, endS: 80, bandsDb: { sub: -6, low: -5, mid: -8, highMid: -10, high: -12 } },
  ],
};

describe("buildBreakdownMessages", () => {
  it("marks the system block as cacheable", () => {
    const { system } = buildBreakdownMessages(input);
    expect(system[0].cache_control).toEqual({ type: "ephemeral" });
    expect(system[0].text.toLowerCase()).toContain("## overall");
  });

  it("renders sections with mm:ss ranges and band labels in the user message", () => {
    const { messages } = buildBreakdownMessages(input);
    const text = messages[0].content as string;
    expect(text).toContain("128"); // bpm
    expect(text).toContain("F# minor");
    expect(text).toContain("0:00–0:18"); // intro range
    expect(text).toContain("0:18–1:20"); // drop range
    expect(text).toMatch(/drop/i);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run lib/refboi/breakdown-prompt.test.ts`
Expected: FAIL — module not found.

**Step 3: Write minimal implementation**

```ts
// lib/refboi/breakdown-prompt.ts
import type { SectionWithSpectra } from "./section-spectra";

export interface BreakdownInput {
  bpm: number;
  key: string;
  lufs: number;
  durationS: number;
  sections: SectionWithSpectra[];
}

export interface SystemBlock {
  type: "text";
  text: string;
  cache_control: { type: "ephemeral" };
}

export interface UserMessage {
  role: "user";
  content: string;
}

// Iterated heavily during Task 7 — this is the IP. Keep the output contract stable.
const SYSTEM_PROMPT = `You are an experienced electronic music producer writing production notes on a reference track for another producer. You are given only derived audio features — never the audio itself.

Voice: terse, technical, peer-to-peer. Assume DAW and mixing vocabulary. No hedging, no disclaimers, no "as an AI". Do not invent a genre you cannot justify from tempo and energy.

Only claim things grounded in the supplied features. Treat band balance qualitatively (e.g. "sub-heavy", "scooped mids", "bright top end") rather than quoting the dB numbers back.

Output contract — markdown only, no preamble and no closing remarks:
- Start with "## Overall" — 3-5 sentences on tempo feel, key, loudness/headroom, and overall spectral character.
- Then one "## <Label> (mm:ss–mm:ss)" heading per supplied section, in the given order, each 2-4 sentences on what's happening and one concrete production takeaway.`;

function mmss(totalSeconds: number): string {
  const s = Math.round(totalSeconds);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export function buildBreakdownMessages(input: BreakdownInput): {
  system: SystemBlock[];
  messages: UserMessage[];
} {
  const header = [
    `Track features:`,
    ``,
    `| field | value |`,
    `| --- | --- |`,
    `| tempo | ${input.bpm} BPM |`,
    `| key | ${input.key} |`,
    `| integrated loudness | ${input.lufs} LUFS |`,
    `| duration | ${mmss(input.durationS)} |`,
    ``,
    `Sections (band levels in dBFS-ish, higher = louder):`,
    ``,
  ];
  const sectionLines = input.sections.map((s) => {
    const b = s.bandsDb;
    return `- **${s.label}** (${mmss(s.startS)}–${mmss(s.endS)}): sub ${b.sub}, low ${b.low}, mid ${b.mid}, highMid ${b.highMid}, high ${b.high}`;
  });

  return {
    system: [{ type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content: [...header, ...sectionLines].join("\n") }],
  };
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run lib/refboi/breakdown-prompt.test.ts`
Expected: PASS (2 tests).

**Step 5: Commit**

```bash
git add lib/refboi/breakdown-prompt.ts lib/refboi/breakdown-prompt.test.ts
git commit -m "feat(refboi): build cached system + per-track breakdown prompts"
```

---

## Task 3: Anthropic client

**Files:**
- Create: `lib/claude/client.ts`

**Step 1: Implement (no automated test — thin SDK wrapper)**

```ts
// lib/claude/client.ts
import Anthropic from "@anthropic-ai/sdk";

let client: Anthropic | null = null;

/** Returns a singleton Anthropic client, or null if no API key is configured. */
export function getAnthropic(): Anthropic | null {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;
  if (!client) client = new Anthropic({ apiKey });
  return client;
}
```

**Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

**Step 3: Commit**

```bash
git add lib/claude/client.ts
git commit -m "feat(shared): add Anthropic SDK client singleton"
```

---

## Task 4: Streaming Route Handler

**Files:**
- Create: `app/api/refboi/breakdown/route.ts`

**Step 1: Implement**

```ts
// app/api/refboi/breakdown/route.ts
import { getAnthropic } from "@/lib/claude/client";
import { buildBreakdownMessages, type BreakdownInput } from "@/lib/refboi/breakdown-prompt";

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
  const anthropic = getAnthropic();
  if (!anthropic) {
    return Response.json({ error: "breakdowns disabled" }, { status: 503 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "invalid JSON" }, { status: 400 });
  }
  if (!isValid(body)) {
    return Response.json({ error: "invalid breakdown input" }, { status: 400 });
  }

  const { system, messages } = buildBreakdownMessages(body);

  try {
    const stream = anthropic.messages.stream({
      model: "claude-sonnet-4-6",
      max_tokens: 1500,
      system,
      messages,
    });

    const encoder = new TextEncoder();
    const readable = new ReadableStream<Uint8Array>({
      async start(controller) {
        try {
          for await (const event of stream) {
            if (
              event.type === "content_block_delta" &&
              event.delta.type === "text_delta"
            ) {
              controller.enqueue(encoder.encode(event.delta.text));
            }
          }
          controller.close();
        } catch {
          controller.error(new Error("stream failed"));
        }
      },
    });

    return new Response(readable, {
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  } catch {
    return Response.json({ error: "breakdown failed" }, { status: 500 });
  }
}
```

**Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors. (If the SDK event union differs, adjust the delta guard to match `@anthropic-ai/sdk` types — confirm via context7 docs for the installed version.)

**Step 3: Manual smoke test (requires a real key in `.env.local`)**

Run: `npm run dev`, then in another shell:
```bash
curl -N -X POST http://localhost:3000/api/refboi/breakdown \
  -H 'Content-Type: application/json' \
  -d '{"bpm":128,"key":"F# minor","lufs":-8.2,"durationS":200,"sections":[{"label":"intro","startS":0,"endS":18,"bandsDb":{"sub":-30,"low":-20,"mid":-18,"highMid":-22,"high":-28}}]}'
```
Expected: markdown streams in token-by-token. Without a key: `{"error":"breakdowns disabled"}` 503.

**Step 4: Commit**

```bash
git add app/api/refboi/breakdown/route.ts
git commit -m "feat(refboi): streaming Claude breakdown route handler"
```

---

## Task 5: `Breakdown` client component

**Files:**
- Create: `components/refboi/Breakdown.tsx`

**Step 1: Implement**

```tsx
// components/refboi/Breakdown.tsx
"use client";

import { useCallback, useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import type { BreakdownInput } from "@/lib/refboi/breakdown-prompt";

type Status = "streaming" | "done" | "error";

export default function Breakdown({ input }: { input: BreakdownInput }) {
  const [text, setText] = useState("");
  const [status, setStatus] = useState<Status>("streaming");

  const run = useCallback(async () => {
    setText("");
    setStatus("streaming");
    try {
      const res = await fetch("/api/refboi/breakdown", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      if (!res.ok || !res.body) {
        const msg =
          res.status === 503
            ? "breakdowns unavailable in this environment"
            : "breakdown request failed";
        setText(msg);
        setStatus("error");
        return;
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let acc = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        acc += decoder.decode(value, { stream: true });
        setText(acc);
      }
      setStatus("done");
    } catch {
      setStatus("error");
      setText((t) => t || "stream interrupted");
    }
  }, [input]);

  useEffect(() => {
    run();
  }, [run]);

  return (
    <section style={{ marginTop: "2rem" }}>
      <h2 style={{ fontSize: 16 }}>production notes</h2>
      <div style={{ fontFamily: "system-ui, sans-serif", lineHeight: 1.5 }}>
        <ReactMarkdown>{text}</ReactMarkdown>
      </div>
      {status === "streaming" && <p style={{ color: "#888", fontSize: 12 }}>generating…</p>}
      {(status === "done" || status === "error") && (
        <button
          onClick={run}
          style={{
            marginTop: "0.5rem",
            fontFamily: "monospace",
            fontSize: 12,
            background: "transparent",
            color: "#888",
            border: "1px solid #2a2a2a",
            padding: "0.3rem 0.6rem",
            cursor: "pointer",
          }}
        >
          {status === "error" ? "retry" : "regenerate"}
        </button>
      )}
    </section>
  );
}
```

**Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

**Step 3: Commit**

```bash
git add components/refboi/Breakdown.tsx
git commit -m "feat(refboi): streaming breakdown component with regenerate"
```

---

## Task 6: Wire `Breakdown` into `RefboiWorkspace`

**Files:**
- Modify: `components/refboi/RefboiWorkspace.tsx`

**Step 1: Add imports**

```ts
import Breakdown from "./Breakdown";
import { sectionsWithSpectra } from "@/lib/refboi/section-spectra";
import type { BreakdownInput } from "@/lib/refboi/breakdown-prompt";
```

**Step 2: Compute `BreakdownInput` (memoized, alongside the existing `series` useMemo)**

```ts
const breakdownInput = useMemo<BreakdownInput | null>(() => {
  if (state.status !== "done") return null;
  return {
    bpm: state.result.bpm,
    key: state.result.key,
    lufs: state.result.lufs,
    durationS: state.result.durationS,
    sections: sectionsWithSpectra(state.result.sections, state.result.features),
  };
}, [state]);
```

**Step 3: Render it after `<SpectralBands />`, inside the `done` block**

```tsx
{breakdownInput && <Breakdown input={breakdownInput} />}
```

**Step 4: Type-check + build**

Run: `npx tsc --noEmit && npm run build`
Expected: no errors; route `/api/refboi/breakdown` appears in the build output.

**Step 5: Commit**

```bash
git add components/refboi/RefboiWorkspace.tsx
git commit -m "feat(refboi): mount breakdown on analysis completion"
```

---

## Task 7: Prompt iteration (human-in-the-loop) — the actual IP

Plumbing is done; this is where the product lives. **Not a code task — a tasting loop.**

**Step 1:** `npm run dev`, upload 3-4 reference tracks you know well (different genres/energy).

**Step 2:** Read each breakdown critically against the track. Look for: generic filler, claims not grounded in features, wrong genre guesses, weak/no production takeaways, broken section ranges.

**Step 3:** Edit `SYSTEM_PROMPT` in `lib/refboi/breakdown-prompt.ts`. Re-run the prompt-builder tests (`npx vitest run lib/refboi/breakdown-prompt.test.ts`) — the output-contract assertions (`## Overall`, mm:ss ranges) must still pass; update them only if you deliberately change the contract.

**Step 4:** Regenerate in-app, compare. Repeat until the breakdown reads like a sharp producer friend, not an AI.

**Step 5:** Commit prompt revisions as you go.

```bash
git commit -am "feat(refboi): tune breakdown system prompt"
```

---

## Definition of done (W3)

Upload an audio file in Chrome → within ~1-3s of analysis finishing, a "production notes" breakdown streams in below the spectral viz (overall on top, per-section commentary keyed to detected sections). Regenerate replays the prompt. Killing the server mid-stream shows a visible error, not a hang. Missing `ANTHROPIC_API_KEY` → inline "unavailable" note, page still works.

## Out of scope (do not drift)

Rate limiting / per-IP caps (W5, **must land before public deploy**), persistence/permalinks (W5), YouTube ingestion (W4), auth, payments, mobile polish, midiboi. The `react-markdown` render is plain CommonMark — no plugins.
