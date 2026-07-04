import type { BreakdownInput, BreakdownMessages } from "./prompt";

export interface JudgeScore {
  /** 1-5: does each comment say something concrete about this track? */
  specificity: number;
  /** 1-5: are the takeaways real, do-it-now mix/arrangement moves? */
  usefulness: number;
  /** 1-5: terse, technical, peer-to-peer — no hedging or hype? */
  voice: number;
  /** 1-10: overall, would a producer find this breakdown worth reading? */
  overall: number;
  /** Soft rule breaks the deterministic scorer can't catch (named sounds, hype words). */
  softViolations: string[];
  notes: string;
}

export type JudgeResult =
  | { ok: true; score: JudgeScore }
  | { ok: false; raw: string };

// The judge prompt is also IP — it defines what "good" means for the breakdown.
const JUDGE_SYSTEM = `You are a strict editor reviewing production notes another producer wrote about a reference track. You are given the derived track facts the writer had, and the breakdown they produced. You have NOT heard the audio either — judge the writing, not the track.

Score it on three axes, 1-5 each:
- specificity: does each comment say something concrete about THIS track's energy/band balance, or is it generic filler that would fit any track?
- usefulness: does each section end with a real do-it-now mix or arrangement move grounded in the data, not vague advice?
- voice: terse, technical, peer-to-peer, DAW-fluent — no hedging, no disclaimers, no hype words ("epic", "lush", "driving", "sonic journey")?

Also list soft_violations: any line that names a specific instrument or sound instead of a frequency band (e.g. "lead", "vocal", "supersaw", "kick"), invents a dB/LUFS number, or uses a hype word. Empty array if none.

Then give an overall score 1-10.

Reply with ONLY a JSON object, no preamble, no code fence, no trailing text:
{"specificity": <1-5>, "usefulness": <1-5>, "voice": <1-5>, "overall": <1-10>, "soft_violations": ["..."], "notes": "<one terse line>"}`;

export function buildJudgeMessages(
  input: BreakdownInput,
  breakdown: string
): BreakdownMessages {
  const facts = [
    `Track facts the writer had:`,
    `- ${input.bpm} BPM, ${input.key}, ${input.sections.length} sections`,
    ``,
    `Breakdown under review:`,
    `"""`,
    breakdown,
    `"""`,
  ].join("\n");
  return { system: JUDGE_SYSTEM, user: facts };
}

function clamp(n: unknown, lo: number, hi: number): number {
  const v = typeof n === "number" && Number.isFinite(n) ? n : lo;
  return Math.min(hi, Math.max(lo, Math.round(v)));
}

/** Extract the first balanced {...} block so we tolerate fences and prose. */
function extractJsonBlock(raw: string): string | undefined {
  const start = raw.indexOf("{");
  if (start === -1) return undefined;
  let depth = 0;
  for (let i = start; i < raw.length; i++) {
    if (raw[i] === "{") depth++;
    else if (raw[i] === "}" && --depth === 0) return raw.slice(start, i + 1);
  }
  return undefined;
}

export function parseJudgeResponse(raw: string): JudgeResult {
  const block = extractJsonBlock(raw);
  if (!block) return { ok: false, raw };
  // Small models routinely emit a trailing comma before a closing ] or } —
  // strict JSON.parse rejects it, so drop those before parsing.
  const cleaned = block.replace(/,(\s*[}\]])/g, "$1");
  let obj: Record<string, unknown>;
  try {
    obj = JSON.parse(cleaned) as Record<string, unknown>;
  } catch {
    return { ok: false, raw };
  }
  const soft = Array.isArray(obj.soft_violations)
    ? obj.soft_violations.map((v) => String(v))
    : [];
  return {
    ok: true,
    score: {
      specificity: clamp(obj.specificity, 1, 5),
      usefulness: clamp(obj.usefulness, 1, 5),
      voice: clamp(obj.voice, 1, 5),
      overall: clamp(obj.overall, 1, 10),
      softViolations: soft,
      notes: typeof obj.notes === "string" ? obj.notes : "",
    },
  };
}
