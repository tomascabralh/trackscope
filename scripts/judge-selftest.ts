/**
 * Judge discrimination self-test. Before trusting the LLM judge to drive prompt
 * iteration, prove it can tell a deliberately GOOD breakdown from a deliberately
 * BAD one. Builds both off each fixture's real section structure, runs the judge
 * N times each, and prints the overall/voice spread. A judge worth optimizing
 * against should score good >> bad; a flat spread means the metric is broken.
 *
 *   OLLAMA_JUDGE_MODEL=llama3.1:8b npm run judge:selftest
 */
import { fixtures } from "../lib/breakdown/__fixtures__";
import type { BreakdownInput } from "../lib/breakdown/prompt";
import { buildJudgeMessages, parseJudgeResponse } from "../lib/breakdown/judge";
import { streamChat } from "../lib/ollama/client";

const JUDGE_MODEL = process.env.OLLAMA_JUDGE_MODEL ?? "llama3.1:8b";
const RUNS = 3;

function mmss(totalSeconds: number): string {
  const s = Math.round(totalSeconds);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

// Terse, in-voice, concrete band moves — no hype, no "sense of", no named sounds.
const GOOD_BODY = [
  "Sub carries it, mids sit back. Roll off 200-400 so the low end stays clean.",
  "Top opens up while the sub thins out. Ride the highs in, leave the bottom for the drop.",
  "Everything below the mids drops out — that's the reset. Keep it dry so the next hit lands.",
  "Low-mids crowd the sub here. Carve a notch under the bottom octave to keep punch.",
  "Highs recede, sub holds. Pull the top down a hair so it reads as a comedown, not a cut.",
  "Bands flatten out toward the tail. Filter the top off gradually instead of muting hard.",
];

// Verbose, hype words, "sense of" filler, named instruments — everything banned.
const BAD_BODY = [
  "This section creates an epic sense of anticipation with a driving supersaw lead and a punchy kick building tension.",
  "A lush, driving energy takes over as the rumbling bass and bright synths create a powerful sonic journey.",
  "The breakdown gives a beautiful feeling of release, with emotional pads and a piercing vocal chop floating overhead.",
  "Massive energy returns with a huge kick and snare combo, delivering an epic, driving wall of sound.",
  "A sense of resolution settles in as the warm pads and gentle plucks bring the track to a satisfying close.",
  "The outro fades with a dreamy, atmospheric sense of closure and a lush ambient texture.",
];

function assemble(input: BreakdownInput, bodies: string[]): string {
  const lines = ["## Overall", bodies[0]];
  input.sections.forEach((sec, i) => {
    lines.push("", `## ${sec.label} (${mmss(sec.startS)}–${mmss(sec.endS)})`, bodies[(i % (bodies.length - 1)) + 1]);
  });
  return lines.join("\n");
}

async function collect(stream: AsyncIterable<string>): Promise<string> {
  let out = "";
  for await (const delta of stream) out += delta;
  return out;
}

async function judgeAvg(input: BreakdownInput, breakdown: string) {
  const { system, user } = buildJudgeMessages(input, breakdown);
  const overalls: number[] = [];
  const voices: number[] = [];
  let parsed = 0;
  for (let i = 0; i < RUNS; i++) {
    const raw = await collect(await streamChat({ model: JUDGE_MODEL, system, user }));
    const r = parseJudgeResponse(raw);
    if (r.ok) {
      parsed++;
      overalls.push(r.score.overall);
      voices.push(r.score.voice);
    }
  }
  const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN);
  return { overall: mean(overalls), voice: mean(voices), parsed };
}

async function main() {
  console.log(`Judge: ${JUDGE_MODEL} · ${RUNS} runs per breakdown\n`);
  let goodSum = 0;
  let badSum = 0;
  for (const f of fixtures) {
    const good = await judgeAvg(f.input, assemble(f.input, GOOD_BODY));
    const bad = await judgeAvg(f.input, assemble(f.input, BAD_BODY));
    goodSum += good.overall;
    badSum += bad.overall;
    console.log(
      `${f.id.padEnd(20)} good overall ${good.overall.toFixed(1)} (voice ${good.voice.toFixed(1)})  ` +
        `vs bad overall ${bad.overall.toFixed(1)} (voice ${bad.voice.toFixed(1)})`
    );
  }
  const n = fixtures.length;
  console.log(
    `\nMEAN  good ${(goodSum / n).toFixed(1)}/10  vs  bad ${(badSum / n).toFixed(1)}/10  ` +
      `→ spread ${((goodSum - badSum) / n).toFixed(1)}`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
