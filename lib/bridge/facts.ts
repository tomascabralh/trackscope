import type { BreakdownInput } from "../breakdown/prompt";
import { describeSections, describeLoudness } from "../breakdown/descriptors";
import { sectionsToBars } from "./bars";
import { sectionRoles, type Role } from "./roles";

export interface BridgeMeta {
  title?: string;
  artist?: string;
  album?: string;
  genre?: string;
  year?: number;
}

export interface AbletonBridgeInput extends BreakdownInput {
  meta?: BridgeMeta;
}

const PITCH_OCTAVE: Partial<Record<Role, number>> = { Sub: 1, Bass: 2, Lead: 3, Pad: 3 };
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

function referenceLine(meta: BridgeMeta | undefined): string {
  const name = meta?.title ?? "untitled reference";
  const tags = [meta?.artist, meta?.genre, meta?.year ? String(meta.year) : undefined].filter(
    Boolean
  );
  return tags.length ? `Reference: ${name} — ${tags.join(", ")}` : `Reference: ${name}`;
}

export function renderFacts(input: AbletonBridgeInput): string {
  const descr = describeSections(input.sections);
  const bars = sectionsToBars(input.sections, input.bpm);
  const rolesPer = descr.map(sectionRoles);
  const root = input.key.split(" ")[0];

  const arrangement = bars.map((b, i) => {
    const d = descr[i];
    const tilt = `sub ${d.bands.sub}, low ${d.bands.low}, mid ${d.bands.mid}, highMid ${d.bands.highMid}, high ${d.bands.high}`;
    return `${i + 1}. ${cap(b.label)} — bars ${b.startBar}–${b.endBar} — ${d.energy} energy — ${tilt} — roles: ${rolesPer[i].join(", ")}`;
  });

  const usedRoles = new Set<Role>(rolesPer.flat());
  const anchors = (Object.keys(PITCH_OCTAVE) as Role[])
    .filter((r) => usedRoles.has(r))
    .map((r) => `${r} ${root}${PITCH_OCTAVE[r]}`)
    .join(", ");

  return [
    referenceLine(input.meta),
    `Tempo: ${input.bpm} BPM   Key: ${input.key}   Loudness: ${describeLoudness(input.lufs)}`,
    "",
    "Arrangement (fixed — keep these bar ranges and order):",
    ...arrangement,
    "",
    `Root-note anchors (key ${input.key}): ${anchors}`,
  ].join("\n");
}

export function buildOfflinePrompt(input: AbletonBridgeInput): string {
  return [
    "You are building a starting-point Ableton Live project from a reference track",
    "analyzed by trackscope. Use the connected ableton-mcp tools.",
    "",
    renderFacts(input),
    "",
    "Set the tempo, create the named tracks per section, lay out arrangement clips at the",
    "bar positions, add a sustained root-note clip per pitched track, and batch the operations.",
  ].join("\n");
}
