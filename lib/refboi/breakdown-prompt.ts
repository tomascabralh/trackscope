import type { SectionWithSpectra } from "./section-spectra";

export interface BreakdownInput {
  bpm: number;
  key: string;
  lufs: number;
  durationS: number;
  sections: SectionWithSpectra[];
}

export interface SystemBlock {
  type: "text";
  text: string;
  cache_control: { type: "ephemeral" };
}

export interface UserMessage {
  role: "user";
  content: string;
}

// Iterated heavily later — this is the IP. Keep the output contract stable.
const SYSTEM_PROMPT = `You are an experienced electronic music producer writing production notes on a reference track for another producer. You are given only derived audio features — never the audio itself.

Voice: terse, technical, peer-to-peer. Assume DAW and mixing vocabulary. No hedging, no disclaimers, no "as an AI". Do not invent a genre you cannot justify from tempo and energy.

Only claim things grounded in the supplied features. Treat band balance qualitatively (e.g. "sub-heavy", "scooped mids", "bright top end") rather than quoting the dB numbers back.

Output contract — markdown only, no preamble and no closing remarks:
- Start with "## Overall" — 3-5 sentences on tempo feel, key, loudness/headroom, and overall spectral character.
- Then one "## <Label> (mm:ss–mm:ss)" heading per supplied section, in the given order, each 2-4 sentences on what's happening and one concrete production takeaway.`;

function mmss(totalSeconds: number): string {
  const s = Math.round(totalSeconds);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export function buildBreakdownMessages(input: BreakdownInput): {
  system: SystemBlock[];
  messages: UserMessage[];
} {
  const header = [
    `Track features:`,
    ``,
    `| field | value |`,
    `| --- | --- |`,
    `| tempo | ${input.bpm} BPM |`,
    `| key | ${input.key} |`,
    `| integrated loudness | ${input.lufs} LUFS |`,
    `| duration | ${mmss(input.durationS)} |`,
    ``,
    `Sections (band levels in dBFS, higher = louder):`,
    ``,
  ];
  const sectionLines = input.sections.map((s) => {
    const b = s.bandsDb;
    return `- **${s.label}** (${mmss(s.startS)}–${mmss(s.endS)}): sub ${b.sub}, low ${b.low}, mid ${b.mid}, highMid ${b.highMid}, high ${b.high}`;
  });

  return {
    system: [{ type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content: [...header, ...sectionLines].join("\n") }],
  };
}
