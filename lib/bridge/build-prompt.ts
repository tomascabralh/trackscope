import type { BreakdownInput } from "../breakdown/prompt";
import { describeSections } from "../breakdown/descriptors";
import { sectionsToBars } from "./bars";
import { sectionRoles, type Role } from "./roles";

const PITCH_OCTAVE: Partial<Record<Role, number>> = {
  Sub: 1,
  Bass: 2,
  Lead: 3,
  Pad: 3,
};

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

function tempoFeel(bpm: number): string {
  if (bpm < 100) return "downtempo";
  if (bpm < 115) return "house-tempo";
  if (bpm < 130) return "club-tempo";
  if (bpm <= 140) return "techno-tempo";
  return "uptempo";
}

export function buildAbletonPrompt(input: BreakdownInput): string {
  const descr = describeSections(input.sections);
  const bars = sectionsToBars(input.sections, input.bpm);
  const rolesPer = descr.map(sectionRoles);

  const root = input.key.split(" ")[0];
  const brief = `${tempoFeel(input.bpm)}, ${input.key}. Energy runs ${descr
    .map((d) => d.energy)
    .join(" -> ")}.`;

  const arrangement = bars.map((b, i) => {
    const roles = rolesPer[i].join(", ");
    return `${i + 1}. ${cap(b.label)} - bars ${b.startBar}–${b.endBar} - ${roles}`;
  });

  const usedRoles = new Set<Role>(rolesPer.flat());
  const anchors = (Object.keys(PITCH_OCTAVE) as Role[])
    .filter((r) => usedRoles.has(r))
    .map((r) => `- ${r}: ${root}${PITCH_OCTAVE[r]}`);

  return [
    "You are building a starting-point Ableton Live project from a reference track",
    "analyzed by trackscope. Use the connected ableton-mcp tools.",
    "",
    `Reference: ${brief}`,
    `Tempo: ${input.bpm} BPM   Key: ${input.key}`,
    "",
    "Arrangement (build in this order, 4/4):",
    ...arrangement,
    "",
    `Placeholder MIDI (one sustained root note per pitched track, key = ${input.key}):`,
    ...anchors,
    "",
    "Set the tempo, create the tracks named above, lay out the arrangement sections at",
    "the bar positions, and add a sustained root-note clip per pitched track spanning its",
    "section. Batch the operations.",
  ].join("\n");
}
