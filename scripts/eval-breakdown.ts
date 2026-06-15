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
import { scoreBreakdown, type Violation } from "../lib/breakdown/score";
import {
  buildJudgeMessages,
  parseJudgeResponse,
  type JudgeResult,
} from "../lib/breakdown/judge";
import { streamChat, OllamaUnavailableError } from "../lib/ollama/client";

const JUDGE_MODEL = process.env.OLLAMA_JUDGE_MODEL ?? process.env.OLLAMA_MODEL ?? "llama3.2:3b";

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
  violations: Violation[];
  judge?: JudgeResult;
  error?: string;
}

/** Ask the judge model to grade a finished breakdown. Best-effort: any failure
 *  degrades to an unparsed result rather than aborting the eval. */
async function judgeOne(fixture: BreakdownFixture, breakdown: string): Promise<JudgeResult> {
  const { system, user } = buildJudgeMessages(fixture.input, breakdown);
  try {
    const raw = await collect(await streamChat({ model: JUDGE_MODEL, system, user }));
    return parseJudgeResponse(raw);
  } catch (err) {
    return { ok: false, raw: err instanceof Error ? err.message : String(err) };
  }
}

async function runOne(fixture: BreakdownFixture, model: string): Promise<RunResult> {
  const { system, user } = buildBreakdownMessages(fixture.input);
  const started = performance.now();
  try {
    const text = await collect(await streamChat({ model, system, user }));
    const ms = performance.now() - started;
    const { violations } = scoreBreakdown(text, fixture.input);
    const judge = await judgeOne(fixture, text);
    return { text, ms, violations, judge };
  } catch (err) {
    const error =
      err instanceof OllamaUnavailableError
        ? `Ollama unavailable: ${err.message}`
        : err instanceof Error
          ? err.message
          : String(err);
    return { text: "", ms: performance.now() - started, violations: [], error };
  }
}

function renderViolations(violations: Violation[]): string {
  if (violations.length === 0) return "**hard rules: clean — 0 violations**";
  const lines = violations.map((v) => `> - \`${v.rule}\` — ${v.detail}`);
  return [`**hard rules: ${violations.length} violation(s)**`, "", ...lines].join("\n");
}

function renderJudge(judge: JudgeResult | undefined): string {
  if (!judge) return "";
  if (!judge.ok) return `**judge: unparsed** — \`${judge.raw.slice(0, 120)}\``;
  const s = judge.score;
  const head = `**judge: ${s.overall}/10** (specificity ${s.specificity}, usefulness ${s.usefulness}, voice ${s.voice}) — ${s.notes}`;
  if (s.softViolations.length === 0) return head;
  const lines = s.softViolations.map((v) => `> - ${v}`);
  return [head, "", "soft violations:", ...lines].join("\n");
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
      const { text, ms, violations, judge, error } = await runOne(fixture, model);
      const judgeTag = judge?.ok ? `, judge ${judge.score.overall}/10` : "";
      const tag = error
        ? `error (${(ms / 1000).toFixed(1)}s)`
        : `${(ms / 1000).toFixed(1)}s — ${violations.length} violation(s)${judgeTag}`;
      console.log(tag);
      parts.push(`### \`${model}\` — ${(ms / 1000).toFixed(1)}s`, ``);
      if (error) {
        parts.push(`> **${error}**`, ``);
      } else {
        parts.push(renderViolations(violations), ``, renderJudge(judge), ``, text.trim(), ``);
      }
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
