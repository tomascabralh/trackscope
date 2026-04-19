# bois

A family of web tools for electronic music producers. Single Next.js app, multiple products under one roof.

## Products

- **refboi** (live) — drop a reference track, get BPM / key / LUFS and (soon) a structural + spectral breakdown. Served at [/refboi](http://localhost:3000/refboi).
- **midiboi** (planned) — starter MIDI generation for producers. Not started yet.

See [CLAUDE.md](CLAUDE.md) for the full product roadmap and working agreements.

## Stack

- Next.js 16 (App Router) + TypeScript
- Tailwind CSS v4
- Essentia.js (WASM, client-side) for audio analysis
- Deployed on Vercel

## Local development

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) for the bois landing page, or go straight to [/refboi](http://localhost:3000/refboi) to use the analyzer.

## Build

```bash
npm run build
npm run start
```

## Repo layout

```
app/
  page.tsx          # bois landing
  refboi/           # refboi product routes
components/
  refboi/           # refboi-specific components
lib/
  audio/            # Essentia wrappers, decoding
public/
  essentia-wasm.web.wasm
```

Shared code lives in `lib/` and `components/ui/` (added when first needed). Product-specific code stays in its own subfolder.
