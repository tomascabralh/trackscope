# refboi W3 — Claude breakdown design

Date: 2026-05-17
Status: Draft (pending user review)

## Goal

After audio analysis completes, refboi sends the derived features to Claude and renders a streaming "production notes" breakdown — overall summary plus per-section commentary — directly in the existing refboi workspace. No persistence, no auth, no permalinks (those are W5).

## Non-goals (out of scope for W3)

- Saving breakdowns (Supabase / permalinks — W5)
- YouTube ingestion (W4)
- midiboi (post-v1)
- Rate limiting, auth, payments
- Mobile polish
- Stem-separated commentary
- User-supplied prompt hints (e.g., "I'm new to mixing")

## Decisions (from brainstorm)

| Decision | Choice |
|---|---|
| Output shape | Hybrid: overall summary + per-section commentary |
| Input features | BPM, key, LUFS, sections (label + start/end) + per-section spectral band averages (sub/low/mid/highMid/high) |
| Voice | Peer producer, technical — DAW/mix vocab assumed |
| Trigger | Auto-run as soon as analysis completes |
| Transport | Streaming token deltas (SSE-style) |
| Response format | Markdown with stable headers (`## Overall`, `## Intro (0:00–0:18)`, …) |
| Regenerate | Button shown after stream completes |
| Architecture | Next.js Route Handler (Node runtime) + Anthropic SDK + prompt caching |
| Model | `claude-sonnet-4-6` |

## Architecture

```
RefboiWorkspace (existing)
   │  analysis 'done' →
   ▼
Breakdown (new client component)
   │  POST { features } →
   ▼
app/api/refboi/breakdown/route.ts (new)
   │  build messages, stream from Anthropic SDK
   ▼
Anthropic API (Claude Sonnet 4.6, system prompt cached)
```

### New files

- `lib/claude/client.ts` — shared Anthropic SDK instantiation (reads `ANTHROPIC_API_KEY`).
- `lib/refboi/section-spectra.ts` — given `Section[]` + `FeatureFrames`, returns per-section averages of each band. Pure function, easily unit-tested.
- `lib/refboi/breakdown-prompt.ts` — builds the `system` (static, cached) and `user` (per-track) message contents from analysis features. Exports a `BreakdownInput` type.
- `app/api/refboi/breakdown/route.ts` — POST handler. Node runtime. Validates body shape, calls Anthropic SDK with `stream: true` and `cache_control: { type: "ephemeral" }` on the system prompt, returns a `ReadableStream` of plain UTF-8 text chunks (just the deltas — no SSE framing needed since we control both ends).
- `components/refboi/Breakdown.tsx` — client component. Receives `BreakdownInput`, kicks off the fetch on mount or on regenerate click, reads the response stream, accumulates a markdown string, renders progressively. Shows a "regenerate" button after stream completes (and an error state if the request fails).

### Modified files

- `components/refboi/RefboiWorkspace.tsx` — when `state.status === "done"`, mount `<Breakdown />` with the derived `BreakdownInput`. Compute the input via the new helpers.
- `package.json` — add `@anthropic-ai/sdk` and `react-markdown`. We only need vanilla CommonMark (headers + emphasis); no plugins.
- `.env.local.example` (new) — document `ANTHROPIC_API_KEY`.

### Data shapes

```ts
// lib/refboi/breakdown-prompt.ts

export interface SectionWithSpectra {
  label: SectionLabel;
  startS: number;
  endS: number;
  bandsDb: { sub: number; low: number; mid: number; highMid: number; high: number };
}

export interface BreakdownInput {
  bpm: number;
  key: string;
  lufs: number;
  durationS: number;
  sections: SectionWithSpectra[];
}
```

Band values: convert linear RMS averages to dBFS-ish (`20 * log10(rms + ε)`) and round to 1 decimal — easier for Claude to reason about and cheaper than raw floats.

### Prompt structure (sketch — full text iterated during implementation)

- **System** (cached):
  - Role: experienced electronic producer reviewing a reference track for another producer.
  - Voice rules: terse, technical, no hedging, no disclaimers, no genre labels you can't justify from the features.
  - Output contract: a `## Overall` section, then one `## <Label> (mm:ss–mm:ss)` section per provided section in order, in markdown only. No preamble, no closing remarks. Each section ~2–4 sentences.
  - Reasoning constraints: only claim things grounded in the supplied features. Treat band balance qualitatively (sub-heavy, mid-scooped) rather than quoting numbers back.
- **User** (per-track):
  - A compact rendering of `BreakdownInput` as a small markdown table + section list.

The system prompt is the IP and will be iterated. The plan should expect prompt revisions to be the bulk of the work after the plumbing lands.

### Streaming protocol

- Server: collect `event.delta.text` from the SDK stream, write each chunk to the `ReadableStream` controller, close on `message_stop`.
- Client: `fetch` → `response.body.getReader()` → decode UTF-8 → append → setState. Render the accumulated string through `react-markdown` on each tick.
- No SSE framing (`data: …\n\n`) — we own both ends and don't need EventSource semantics.

### Prompt caching

System prompt is identical across all calls; per-track payload changes. Mark the system block with `cache_control: { type: "ephemeral" }`. Five-minute TTL is plenty for iteration sessions and for users uploading several tracks.

## UI flow

1. User uploads file → existing analysis pipeline runs.
2. When state hits `done`, `<Breakdown />` mounts and immediately POSTs to `/api/refboi/breakdown`.
3. Tokens stream in; markdown renders progressively below the spectral viz.
4. On `message_stop`, show a small "regenerate" button. Click → re-runs the same request, replacing the prior breakdown.
5. On error, show inline message + "retry" button.

## Error handling

- Server: validate body shape (reject malformed). Catch SDK errors → return HTTP 500 with a short JSON error body, do not leak SDK details.
- Client: any non-200 → render an inline error with a retry affordance. Network failure during streaming → keep what arrived and show "stream interrupted — retry?"
- Missing `ANTHROPIC_API_KEY` at boot: route returns 503 with `{ error: "breakdowns disabled" }`. Client renders a small "breakdowns unavailable in this environment" note rather than blowing up the page.

## Testing approach

- `lib/refboi/section-spectra.ts`: pure function — add unit tests with synthetic `FeatureFrames` (no audio decode needed).
- `lib/refboi/breakdown-prompt.ts`: snapshot the rendered user message for a known fixture.
- Route handler: skip automated tests for W3; manual verification with a real key + a known reference track.
- UI: verify in Chrome that streaming renders progressively (not all-at-once), regenerate replaces content, and error state appears when the route is killed mid-stream.

## Known limitations / follow-ups

- **No rate limiting.** Every successful upload triggers one Claude call automatically; every regenerate click triggers another. Fine for solo / pre-launch use; **must add a guard before public deploy**. Track for W5 when Supabase + permalinks land (per-IP daily cap is the obvious move).
- **No persistence.** Refresh = breakdown gone. Permalinks land in W5.
- **No prompt versioning.** When the system prompt changes, old streams aren't replayable. Acceptable until persistence exists.

## Definition of done

I can upload an audio file in Chrome, and within ~1–3 seconds of analysis finishing, see a "production notes" breakdown stream into the page below the spectral viz — overall summary on top, per-section commentary keyed to the detected sections. A regenerate button below replays the prompt. Killing the server mid-stream produces a visible error, not a hang.
