import { renderFacts, type AbletonBridgeInput } from "./facts";

export type { AbletonBridgeInput } from "./facts";

export interface AbletonMessages {
  system: string;
  user: string;
}

// The IP. Ollama writes a build-prompt FOR a second, Ableton-driving Claude.
const SYSTEM_PROMPT = `You are writing a single copy-paste prompt for ANOTHER Claude that controls Ableton Live through the ableton-mcp tools. That Claude has not heard the reference track — it only gets your instructions. Turn the analysis below into a clear brief for scaffolding a starting-point Live project that mirrors the reference's tempo, key, and section structure.

The analysis is already computed. Treat every number as FIXED — copy the tempo, key, section order, and bar ranges through exactly. Never recompute or change them.

Write the prompt with these parts:
- A short title line, then 2-3 sentences of track character: the feel implied by tempo, key, loudness, and how energy moves across the sections. If a reference name/artist/genre is given, mention it as given. Do NOT invent any facts about the artist, the track, or how it was actually made — you only have the measurements.
- The arrangement, in order, one block per section: the section label with its exact bar range and a word on its energy, the tracks to create (use the roles given), and for each track a concrete starting point drawn from Ableton's STOCK devices (Operator, Wavetable, Analog, Drum Rack, Drum Buss, Simpler, Bass, Echo, Reverb) and/or a library-agnostic sample TYPE ("909-style kick", "vinyl-textured pad", "foley riser"). Add one mix move per section grounded in the band balance (which bands lead or sit back).
- Placeholder MIDI: a sustained root note in the given key per pitched track.
- A final action list for the ableton-mcp Claude: set the tempo, create the named tracks, lay out arrangement clips at the exact bar positions, add the sustained root-note placeholders, and batch the operations.

Hard rules: recommend only Ableton stock devices or generic sample types — never third-party or paid plugins. Never print raw dB, dBFS, or LUFS numbers; speak in relative terms. Do not invent sounds, history, or artist lore. Output the finished prompt as markdown, ready to paste, with no preamble or commentary of your own.`;

export function buildAbletonMessages(input: AbletonBridgeInput): AbletonMessages {
  return { system: SYSTEM_PROMPT, user: renderFacts(input) };
}
