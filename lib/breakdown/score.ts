import type { BreakdownInput } from "./prompt";

export interface Violation {
  rule: "no-invented-levels" | "no-named-instruments" | "structure";
  detail: string;
}

export interface BreakdownScore {
  violations: Violation[];
  passed: boolean;
}

// A number glued to a level unit = an invented measurement. BPM is a different
// unit and is intentionally not matched, so the model can state tempo outright.
const LEVEL_FIGURE = /-?\d+(?:\.\d+)?\s*(?:dbfs|db|lufs)\b/gi;

// Words that name an instrument/sound rather than a frequency band. Band words
// (sub, low, mid, high) are allowed; these are not. Matched whole-word only so
// "sub-led" / "low end" don't trip the instrument check.
const NAMED_INSTRUMENTS = [
  "supersaw",
  "saw",
  "vocal",
  "vocals",
  "synth",
  "synths",
  "kick",
  "snare",
  "snares",
  "hat",
  "hats",
  "hihat",
  "hi-hat",
  "piano",
  "guitar",
  "pluck",
  "plucks",
  "arp",
  "arpeggio",
  "bassline",
];
const INSTRUMENT_RE = new RegExp(
  `\\b(${NAMED_INSTRUMENTS.join("|")})\\b`,
  "gi"
);

/** Label part of a "## intro (0:00–0:30)" heading, e.g. "intro". Tolerates the
 *  model wrapping the heading text in markdown emphasis (`## **intro (…)**`). */
function headingLabel(line: string): string {
  const body = line.replace(/^##\s+/, "").replace(/[*_]/g, "");
  const paren = body.indexOf(" (");
  return (paren === -1 ? body : body.slice(0, paren)).trim();
}

function checkLevels(text: string): Violation[] {
  return [...text.matchAll(LEVEL_FIGURE)].map((m) => ({
    rule: "no-invented-levels" as const,
    detail: `invented level "${m[0].trim()}" — speak in relative tilt words`,
  }));
}

function checkInstruments(text: string): Violation[] {
  return [...text.matchAll(INSTRUMENT_RE)].map((m) => ({
    rule: "no-named-instruments" as const,
    detail: `named sound "${m[0]}" — name the band, not the instrument`,
  }));
}

function checkStructure(text: string, input: BreakdownInput): Violation[] {
  const headings = text
    .split("\n")
    .filter((l) => /^##\s+/.test(l))
    .map(headingLabel);
  const expected = ["Overall", ...input.sections.map((s) => s.label)];

  const same =
    headings.length === expected.length &&
    expected.every((label, i) => headings[i]?.toLowerCase() === label.toLowerCase());

  if (same) return [];
  return [
    {
      rule: "structure" as const,
      detail: `headings ${JSON.stringify(headings)} do not match expected ${JSON.stringify(expected)}`,
    },
  ];
}

/**
 * Grade a breakdown string against the prompt's hard, deterministic rules.
 * Quality (is the advice good?) still needs a human or LLM judge — this only
 * catches the contract violations the system prompt forbids outright.
 */
export function scoreBreakdown(
  text: string,
  input: BreakdownInput
): BreakdownScore {
  const violations = [
    ...checkLevels(text),
    ...checkInstruments(text),
    ...checkStructure(text, input),
  ];
  return { violations, passed: violations.length === 0 };
}
