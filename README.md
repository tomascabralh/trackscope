# trackscope

Point it at a reference track and get a producer-language breakdown of how it's
put together. All analysis runs locally — nothing leaves your machine.

## What it is

Drop an audio file in the browser (Chrome, desktop) and trackscope:

- decodes and analyzes it **client-side** with [Essentia.js](https://essentia.upf.edu/)
  (WASM) — BPM, musical key, and LUFS loudness;
- detects structural sections (intro / buildup / drop / breakdown / outro) and
  draws a waveform timeline plus a spectral-balance view;
- feeds per-section spectra into a **local LLM** (via [Ollama](https://ollama.com/))
  that streams back a "production notes" breakdown — an overall summary plus
  commentary keyed to each section.

The audio never gets uploaded anywhere, and the LLM is whatever model you run
locally. trackscope is a single-page Next.js app.

## Requirements

- **Node** 18+ and **npm**
- **[Ollama](https://ollama.com/)** running locally with the default model pulled:

  ```bash
  ollama pull llama3.2:3b
  ollama serve
  ```

  (Any chat model works — point trackscope at it with `OLLAMA_MODEL`.)

## Run

```bash
npm install
npm run dev          # http://localhost:3000
```

In another shell, make sure `ollama serve` is running. Open the app, drop in a
track, and the breakdown streams in once analysis finishes.

## Configuration

The breakdown client reads two optional env vars (see `.env.local.example`):

| Variable       | Default                  | Purpose                              |
| -------------- | ------------------------ | ------------------------------------ |
| `OLLAMA_HOST`  | `http://127.0.0.1:11434` | Where the Ollama server listens.     |
| `OLLAMA_MODEL` | `llama3.2:3b`            | Which model to run the breakdown on. |

If Ollama is unreachable, the breakdown panel shows an error (HTTP 503) rather
than hanging.

## Scripts

```bash
npm run dev      # dev server (Turbopack)
npm run build    # production build
npm run start    # serve the production build
npm run test     # vitest run
```

## Scope

**In:** client-side analysis (BPM / key / LUFS / sections / spectra) and the
streaming local-LLM breakdown.

**Deferred / not built:** YouTube ingestion, persistence and shareable
permalinks, and rate-limiting. There's no hosted instance — run it locally.

The system prompt that generates the breakdown is the heart of the project and
is still being tuned; breakdown quality will keep improving.

## Contributing

Issues and PRs welcome. Before submitting, please run:

```bash
npm run test
npm run build
```

## License

[MIT](LICENSE) © 2026 Tomas Cabral Hunter
