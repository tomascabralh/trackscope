# trackscope

A single-page web tool for electronic music producers: drop a reference track,
get a producer-language breakdown of how it's built. All analysis runs locally
in the browser; the LLM breakdown runs against a local Ollama server. Nothing
leaves the machine.

**Status:** audio spine + structure/visuals shipped; the streaming Ollama
breakdown is wired end to end and works locally. Active work is tuning the
system prompt (the IP) for breakdown quality.

## What it does

1. Decode + analyze an uploaded audio file **client-side** with Essentia.js
   (WASM): BPM, musical key, LUFS loudness.
2. Detect structural sections (intro / buildup / drop / breakdown / outro);
   render a waveform timeline with markers and a spectral-balance view.
3. Feed per-section spectra into a **local Ollama** model, which streams back a
   "production notes" breakdown (overall summary + per-section commentary).

## Stack

- Next.js 16 (App Router, Turbopack) + TypeScript
- Tailwind CSS v4
- Essentia.js (WASM, client-side) for audio analysis
- wavesurfer.js for the waveform timeline
- **Breakdown LLM = local Ollama**, streamed via `lib/ollama/client.ts`
  (NDJSON → text deltas). Defaults: `http://127.0.0.1:11434`, model
  `llama3.2:3b`; override with `OLLAMA_HOST` / `OLLAMA_MODEL` (see
  `.env.local.example`). Requires `ollama serve` running with the model pulled.
- Package manager: `npm`. Deploy target: Vercel as a portfolio demo with
  `NEXT_PUBLIC_DEMO_MODE=1` (`lib/demo.ts`) — analysis still runs client-side,
  but the Ollama breakdown is gated off with a "run it locally" notice. The
  full experience still means running locally with Ollama.

## Repo structure

Single Next.js app, analyzer at the root route:

```
app/
  page.tsx              # root — renders <Workspace />
  layout.tsx            # metadata + footer
  api/breakdown/        # streaming breakdown Route Handler (NDJSON → text)
  globals.css, favicon.ico
components/              # all UI lives here (flat, no subfolders)
  Workspace.tsx         # top-level analyzer composition
  Uploader.tsx, TrackInfo.tsx, ResultsPanel.tsx,
  WaveformTimeline.tsx, SpectralBands.tsx, Breakdown.tsx
lib/
  audio/                # Essentia wrappers, decoding, sections, spectral
  breakdown/            # per-section spectral averaging + prompt-building (the IP)
  bridge/               # analysis → copy-paste Ableton build-prompt
  ollama/               # local Ollama chat client, NDJSON streaming
```

No barrel exports. Path alias `@/*` → repo root.

## How it's wired

- Streaming Route Handler `app/api/breakdown/route.ts`: NDJSON from Ollama →
  text stream; 503 if Ollama is down, 400 on bad input, aborts upstream on
  client disconnect.
- Local Ollama chat client: `lib/ollama/client.ts`.
- Per-section spectral averaging + prompt-building: `lib/breakdown/`
  (`section-spectra.ts`, `prompt.ts`). **The system prompt is the IP** and is
  still being iterated on.
- Ableton bridge: `lib/bridge/` turns the same `BreakdownInput` into a
  copy-paste prompt for an Ableton-driving Claude (bars + roles + prompt).
  Rendered by `<AbletonPanel />`; no dependency on the Ollama breakdown.
- `<Breakdown />` auto-runs on analysis `done`, streams markdown, has a
  regenerate button.

## Working agreements

- **Plan-first on non-trivial work.** Especially WASM and anything touching
  multiple `lib/` modules. Propose the approach before writing code.
- **Commit after every completed task.** Conventional commits (`feat:`, `fix:`,
  `refactor:`, `chore:`, `docs:`).
- **Be honest on tradeoffs.** I'm a frontend engineer and a producer — speak to
  both sides, no coddling.
- **Shared code goes in `lib/`.** Keep components flat under `components/`.

## Known constraints / gotchas

- **Essentia.js is WASM, client-side only.** Use `'use client'` + dynamic import
  with `{ ssr: false }`. If hosting later, serve `.wasm` as `application/wasm`.
- **15-minute audio cap.** Enforce client-side after metadata load, before
  decoding. Downsample to mono 22kHz before handing to Essentia.
- **Tailwind v4** uses CSS-first config (`@theme` directive) — no JS config file.
- **First breakdown token is slow** — the local model cold-loads on the first
  request; subsequent runs are faster.

## Out of scope (deferred)

YouTube ingestion, persistence / shareable permalinks, rate-limiting, a hosted
LLM for the breakdown, stem separation, auth/payments, mobile polish. No behavior changes
should sneak in under "rename/refactor" work.

## North star

The breakdown prompt is the actual IP. A mediocre breakdown makes this a toy; a
great one makes it shareable. Everything else serves that output.
