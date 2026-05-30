# Design: rename `bois` → `trackscope`, collapse to single-product OSS

**Date:** 2026-05-30
**Status:** approved (brainstorming complete; implementation plan to follow)

## Summary

The repo currently called `bois` is a deliberately multi-product roof — refboi
(built) plus a planned midiboi — hence the `app/refboi/`, `components/refboi/`,
`lib/refboi/` nesting and a `bois` landing page at root. We are collapsing this
into a **single-purpose open-source project named `trackscope`**. The
`bois` / `refboi` / `midiboi` framing retires completely; the multi-product
scaffolding is removed so the repo reads as a single tool.

This is a **rename + restructure only**. No behavior changes to the analyzer or
the breakdown.

## Decisions

| Decision | Choice | Rationale |
| --- | --- | --- |
| New name | `trackscope` | "scope" = measurement instrument (oscilloscope/spectroscope); you point it at a reference track. npm + GitHub org both free. |
| Identity | Single-product OSS | Drop the bois umbrella + midiboi vision. Simplest to open-source and explain. |
| Restructure | Full flatten (Approach A) | One-time identity reset; half-measures leave `bois` scaffolding as cruft that contradicts the README. |
| License | MIT | Permissive, shortest, most common for JS/web OSS. |
| `lib/refboi` target | `lib/breakdown` | That code builds the breakdown prompt + feeds per-section spectra to it. |

## Migration map

### Routes / app
- `app/page.tsx` (bois landing) → **deleted**; analyzer becomes the root page.
- `app/refboi/page.tsx` → content moves to `app/page.tsx`; `app/refboi/` removed.
- `app/api/refboi/breakdown/route.ts` → `app/api/breakdown/route.ts`.
- `app/layout.tsx` metadata title `"bois"` → `"trackscope"`.
- `app/globals.css`, `app/favicon.ico` → unchanged (new favicon/logo out of scope).

### components/ (flatten — drop the `refboi/` subfolder)
- `RefboiWorkspace.tsx` → `Workspace.tsx`, component `RefboiWorkspace` → `Workspace`.
- `Breakdown.tsx`, `ResultsPanel.tsx`, `SpectralBands.tsx`, `TrackInfo.tsx`,
  `Uploader.tsx`, `WaveformTimeline.tsx` → `components/*` (names unchanged).

### lib/ (flatten + drop dead code)
- `lib/refboi/` → `lib/breakdown/`:
  - `breakdown-prompt.ts` → `prompt.ts` (+ `breakdown-prompt.test.ts` → `prompt.test.ts`)
  - `section-spectra.ts` (+ test) → stays, moved into `lib/breakdown/`
- `lib/claude/client.ts` → **deleted** (dead since the Ollama swap).
- `@anthropic-ai/sdk` → **removed** from `package.json` dependencies.
- `lib/audio/`, `lib/ollama/`, `lib/empty-module.js` → unchanged.
- `package.json` name `bois` → `trackscope`.
- All `@/...refboi` / `@/lib/claude` imports updated; the `@/` path alias stays.

## OSS hygiene (new files / rewrites)
- **`LICENSE`** — MIT, attributed to the repo owner.
- **`README.md`** — full rewrite: what it is, run steps (Node + `npm`, plus
  `ollama serve` with the default model pulled), env vars (`OLLAMA_HOST` /
  `OLLAMA_MODEL`, see `.env.local.example`), scope/roadmap, license, short
  Contributing section.
- **`CLAUDE.md`** — rewrite from multi-product roof → single-product trackscope;
  drop the scope-boundary / midiboi rules.
- Historical `docs/plans/*` and `docs/superpowers/specs/*` left as dated records
  (not renamed).

## Process & verification
- New branch off current HEAD: `chore/rename-to-trackscope` (carries the in-flight
  W3 Ollama work). Use `git mv` so history follows files.
- **GitHub repo rename is a manual step by the owner** (Settings → rename
  `bois` → `trackscope`); then `git remote set-url origin …/trackscope.git`.
- Verify after restructure: `npm run test` (currently 7 tests), `npm run build`,
  and a live upload + breakdown run against local Ollama.

## Out of scope (unchanged)
YouTube ingestion, persistence / permalinks, rate-limiting, new favicon/logo,
domain / public deploy. No behavior changes to analysis or breakdown.

## Notes
- No secrets in git history (`.env*` gitignored; only `.env.local.example`
  tracked) — safe to open-source.
- The parent-workspace `projects/CLAUDE.md` (outside this repo) also references
  `bois`; updating it is a follow-up in that separate location, not part of this
  repo's change.
