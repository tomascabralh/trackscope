# bois

A family of web tools for electronic music producers. Single Next.js app, multiple products under one roof, shared design system + utilities.

## Products

### refboi (current focus)

Analyze reference tracks → producer-language breakdowns. Drop a track, get BPM/key/LUFS, structural timeline, spectral analysis, and a Claude-generated "production notes" breakdown.

**Status: W1 shipped (audio spine — BPM/key/LUFS from file upload). W2 next.**

### midiboi (planned, not started)

Generate starter MIDI files for producers — chord progressions, basslines, drum patterns, toplines — in a chosen key, BPM, and genre vibe. One-click download, drag into Ableton.

**Status: scoped but not started. DO NOT build any midiboi code until refboi v1 ships.**

Future handoff: refboi analysis pages will deep-link to midiboi with key/BPM/genre pre-filled. Build only after both products work independently.

## Stack (shared across all products)

- Next.js 15 (App Router) + TypeScript
- Tailwind CSS v4 + shadcn/ui
- Bun (package manager + runtime — prefer `bun` over `npm`/`pnpm`/`yarn`)
- Supabase for storage (shared instance, namespaced tables per product)
- Claude Sonnet 4.6 via Anthropic API
- Deploy: Vercel (single deployment, all products)

### refboi-specific

- Essentia.js (WASM, client-side) for audio analysis
- wavesurfer.js for waveform viz (W2+)
- yt-dlp worker on Railway/Fly for YouTube ingestion (W4+)

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
  claude/               # shared Claude API client + prompt utilities
  supabase/             # shared DB client + types
  ui/                   # shared design tokens (colors, typography)
components/
  ui/                   # shadcn components (shared)
  refboi/               # refboi-specific components
  midiboi/              # midiboi-specific components (future)
```

Shared code lives in `lib/` and `components/ui/`. Product-specific code stays in its own subfolder. No barrel exports.

## Current phase: refboi W2 — Structure + visuals

**In scope this week:**

- Heuristic section detection (intro/breakdown/drop) from audio features
- wavesurfer.js timeline with section markers
- Basic spectral visualization

**Explicitly out of scope right now:**

- Any midiboi work (see above — do not start)
- Claude API integration → refboi W3
- YouTube ingestion → refboi W4
- Supabase / permalinks → refboi W5
- Landing page (bois hub or refboi) → refboi W5
- Stem separation, Ableton export, auth, payments, mobile polish

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
- **Bun runtime quirks.** If Next dev server HMR misbehaves, fall back to `bun install` + `node` for dev.

## What "done" looks like for refboi W2

I can upload an audio file and see: a wavesurfer timeline with visual section markers (intro / buildup / drop / breakdown / outro) that roughly line up with where those sections actually are in the track. Basic spectral viz showing frequency balance across the track. No polish beyond making it readable. Works in Chrome on desktop.

## North star

The Claude prompts are the actual IP. A mediocre breakdown makes refboi a toy; a great one makes it shareable. Same principle will apply to midiboi (great template library + smart selection > generic "AI makes MIDI"). Everything else serves that output.
