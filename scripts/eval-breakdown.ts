/**
 * Breakdown eval harness. Runs each fixture through the real prompt builder and
 * the local Ollama client, for one or more models, and writes the outputs
 * side-by-side to eval-out/<timestamp>.md so prompt/model changes can be judged
 * on evidence instead of one-off vibes.
 *
 *   npm run eval:breakdown                       # all fixtures, default model
 *   npm run eval:breakdown -- --model llama3.2:3b,llama3.1:8b
 *   npm run eval:breakdown -- --fixture house-peaktime
 *
 * Requires `ollama serve` running with the chosen model(s) pulled.
 */
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import { fixtures, type BreakdownFixture } from "../lib/breakdown/__fixtures__";
import { buildBreakdownMessages } from "../lib/breakdown/prompt";
import { streamChat, OllamaUnavailableError } from "../lib/ollama/client";

function parseArgs(argv: string[]) {
  const get = (flag: string) => {
    const i = argv.indexOf(flag);
    return i !== -1 ? argv[i + 1] : undefined;
  };
  const models = (get("--model") ?? process.env.OLLAMA_MODEL ?? "llama3.2:3b")
    .split(",")
    .map((m) => m.trim())
    .filter(Boolean);
  const fixtureId = get("--fixture");
  return { models, fixtureId };
}

async function collect(stream: AsyncIterable<string>): Promise<string> {
  let out = "";
  for await (const delta of stream) out += delta;
  return out;
}

/** Drain one tiny request so cold-load latency doesn't pollute the timed runs. */
async function warm(model: string): Promise<void> {
  try {
    await collect(await streamChat({ model, system: "", user: "warmup. reply with: ok" }));
  } catch {
    /* surfaced later when the real run fails */
  }
}

interface RunResult {
  text: string;
  ms: number;
  error?: string;
}

async function runOne(fixture: BreakdownFixture, model: string): Promise<RunResult> {
  const { system, user } = buildBreakdownMessages(fixture.input);
  const started = performance.now();
  try {
    const text = await collect(await streamChat({ model, system, user }));
    return { text, ms: performance.now() - started };
  } catch (err) {
    const error =
      err instanceof OllamaUnavailableError
        ? `Ollama unavailable: ${err.message}`
        : err instanceof Error
          ? err.message
          : String(err);
    return { text: "", ms: performance.now() - started, error };
  }
}

function renderInputTable(f: BreakdownFixture): string {
  const { input } = f;
  const head = `**${input.bpm} BPM · ${input.key} · ${input.lufs} LUFS · ${input.sections.length} sections**`;
  const rows = input.sections
    .map((s) => `  - ${s.label} (${s.startS}–${s.endS}s)`)
    .join("\n");
  return `${head}\n${rows}`;
}

async function main() {
  const { models, fixtureId } = parseArgs(process.argv.slice(2));
  const selected = fixtureId ? fixtures.filter((f) => f.id === fixtureId) : fixtures;
  if (selected.length === 0) {
    console.error(`No fixture matched "${fixtureId}". Available: ${fixtures.map((f) => f.id).join(", ")}`);
    process.exit(1);
  }

  console.log(`Models: ${models.join(", ")}`);
  console.log(`Fixtures: ${selected.map((f) => f.id).join(", ")}\n`);

  console.log("Warming models…");
  for (const model of models) await warm(model);

  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const parts: string[] = [
    `# Breakdown eval — ${stamp}`,
    ``,
    `Models: ${models.map((m) => `\`${m}\``).join(", ")}`,
    ``,
  ];

  for (const fixture of selected) {
    console.log(`\n=== ${fixture.id} ===`);
    parts.push(`## ${fixture.id}`, ``, renderInputTable(fixture), ``);
    for (const model of models) {
      process.stdout.write(`  ${model}… `);
      const { text, ms, error } = await runOne(fixture, model);
      console.log(error ? `error (${(ms / 1000).toFixed(1)}s)` : `${(ms / 1000).toFixed(1)}s`);
      parts.push(`### \`${model}\` — ${(ms / 1000).toFixed(1)}s`, ``);
      parts.push(error ? `> **${error}**` : text.trim(), ``);
    }
  }

  const outDir = resolve(process.cwd(), "eval-out");
  await mkdir(outDir, { recursive: true });
  const outPath = resolve(outDir, `${stamp}.md`);
  await writeFile(outPath, parts.join("\n"), "utf8");
  console.log(`\nWrote ${outPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
