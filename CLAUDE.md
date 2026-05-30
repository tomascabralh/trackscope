# bois

A family of web tools for electronic music producers. Single Next.js app, multiple products under one roof, shared design system + utilities.

## Products

### refboi (current focus)

Analyze reference tracks → producer-language breakdowns. Drop a track, get BPM/key/LUFS, structural timeline, spectral analysis, and an LLM-generated "production notes" breakdown.

**Status: W1 + W2 shipped (audio spine + structure/visuals). W3 breakdown wired end to end — analysis → streaming Ollama breakdown working locally. Now iterating on the prompt (the IP).**

### midiboi (planned, not started)

Generate starter MIDI files for producers — chord progressions, basslines, drum patterns, toplines — in a chosen key, BPM, and genre vibe. One-click download, drag into Ableton.

**Status: scoped but not started. DO NOT build any midiboi code until refboi v1 ships.**

Future handoff: refboi analysis pages will deep-link to midiboi with key/BPM/genre pre-filled. Build only after both products work independently.

## Stack (shared across all products)

- Next.js 15 (App Router) + TypeScript
- Tailwind CSS v4 + shadcn/ui
- npm (package manager)
- Supabase for storage (shared instance, namespaced tables per product)
- LLM breakdown: **local Ollama** (`llama3.1:8b` default) — *not* the Anthropic API (see refboi-specific note below)
- Deploy: Vercel (single deployment, all products)

### refboi-specific

- Essentia.js (WASM, client-side) for audio analysis
- wavesurfer.js for waveform viz (W2+)
- yt-dlp worker on Railway/Fly for YouTube ingestion (W4+)
- **Breakdown LLM = local Ollama**, streamed via `lib/ollama/client.ts` (NDJSON → text deltas). Defaults: `http://127.0.0.1:11434`, model `llama3.1:8b`; override with `OLLAMA_HOST` / `OLLAMA_MODEL` (see `.env.local.example`). Requires `ollama serve` running with the model pulled. W3 swapped off the Anthropic SDK — `lib/claude/client.ts` and the `@anthropic-ai/sdk` dep are now dead and pending removal.

### midiboi-specific (future)

- midi-writer-js for MIDI file generation
- tonal for music theory
- Tone.js for in-browser preview

## Repo structure

Single Next.js app, product routes under `app/`:

```
app/
  page.tsx              # bois landing (W5+)
  refboi/               # refboi product surface
  midiboi/              # midiboi product surface (future)
lib/
  audio/                # Essentia wrappers, decoding — refboi
  music-theory/         # tonal wrappers, chord/scale logic — midiboi
  ollama/               # local Ollama chat client, NDJSON streaming — refboi breakdown
  claude/               # legacy Anthropic client — dead since W3 Ollama swap, pending removal
  refboi/               # per-section spectral averaging + breakdown prompt-building (the IP)
  supabase/             # shared DB client + types
  ui/                   # shared design tokens (colors, typography)
components/
  ui/                   # shadcn components (shared)
  refboi/               # refboi-specific components
  midiboi/              # midiboi-specific components (future)
```

Shared code lives in `lib/` and `components/ui/`. Product-specific code stays in its own subfolder. No barrel exports.

## Current phase: refboi W3 — LLM breakdown (local Ollama)

Design history: original Claude-based design at `docs/superpowers/specs/2026-05-17-refboi-w3-claude-breakdown-design.md`; the Ollama swap is in `docs/plans/2026-05-24-refboi-ollama-breakdown-design.md` (+ implementation plan alongside).

**Built and working (verified end to end against local Ollama):**

- Streaming Route Handler `app/api/refboi/breakdown` (NDJSON from Ollama → text stream; 503 if Ollama down, 400 on bad input, aborts upstream on client disconnect)
- Local Ollama chat client (`lib/ollama/client.ts`)
- Per-section spectral averaging + prompt-building helpers (`lib/refboi/`)
- `<Breakdown />` client component: auto-runs on analysis `done`, streams markdown, regenerate button

**Still the active work:**

- The system prompt itself (the IP — most remaining effort is here; iterating on output quality)

**Explicitly out of scope right now:**

- Any midiboi work (see above — do not start)
- Rate limiting / per-IP caps → refboi W5 (must land before public deploy)
- YouTube ingestion → refboi W4
- Supabase / permalinks / persistence → refboi W5
- Landing page (bois hub or refboi) → refboi W5
- Stem separation, Ableton export, auth, payments, mobile polish

**Shipped (W2):** section detection, wavesurfer timeline with markers, spectral viz, track metadata, transport controls, pipeline progress.

If a task drifts toward any of the above, push back and remind me of the boundary.

## Working agreements

- **Plan-first on non-trivial work.** Especially WASM and anything touching multiple `lib/` modules. Propose the approach before writing code.
- **Commit after every completed task.** Conventional commits (`feat(refboi):`, `fix(shared):`, `chore:`, `refactor:`). Scope prefix matters now that there will be multiple products.
- **Be honest on tradeoffs.** I'm a frontend engineer and a producer — speak to both sides, no coddling.
- **Don't scope-creep.** Out-of-scope items stay out. midiboi stays out until refboi v1 ships.
- **Shared code goes in `lib/` and `components/ui/`.** Product-specific code stays in its own folder. If you find yourself duplicating logic across products later, lift it to `lib/`.

## Known constraints / gotchas

- **Essentia.js is WASM, client-side only.** Use `'use client'` + dynamic import with `{ ssr: false }`. Verify Vercel serves `.wasm` with `application/wasm` — may need `next.config.ts` headers.
- **15-minute audio cap.** Enforce client-side after metadata load, before decoding. Downsample to mono 22kHz before handing to Essentia.
- **Tailwind v4 breaking changes.** CSS-first config, `@theme` directive. Verify shadcn components are v4-compatible when copying.

## What "done" looks like for refboi W3

I can upload an audio file in Chrome and, after analysis finishes, see a "production notes" breakdown stream into the page below the spectral viz — overall summary on top, per-section commentary keyed to the detected sections. A regenerate button replays the prompt. With Ollama down the page shows a visible error (503), not a hang. (Note: first token is slower than the original ~1–3s target — local `llama3.1:8b` cold-loads on the first request.)

**W2 (done):** upload → wavesurfer timeline with section markers (intro / buildup / drop / breakdown / outro) roughly aligned to the track, plus spectral viz showing frequency balance. Readable, Chrome desktop.

## North star

The breakdown prompts are the actual IP. A mediocre breakdown makes refboi a toy; a great one makes it shareable. Same principle will apply to midiboi (great template library + smart selection > generic "AI makes MIDI"). Everything else serves that output.
