import { describe, it, expect } from "vitest";
import { renderFacts, buildOfflinePrompt, type AbletonBridgeInput } from "./facts";
import { fixtures } from "../breakdown/__fixtures__";

describe("renderFacts", () => {
  for (const { id, input } of fixtures) {
    describe(id, () => {
      const facts = renderFacts(input);

      it("states tempo and key", () => {
        expect(facts).toContain(`Tempo: ${input.bpm} BPM`);
        expect(facts).toContain(`Key: ${input.key}`);
      });

      it("has one ordered arrangement line per section with a bar range and roles", () => {
        const lines = facts.split("\n").filter((l) => /^\d+\.\s/.test(l.trim()));
        expect(lines).toHaveLength(input.sections.length);
        for (const l of lines) {
          expect(l).toMatch(/bars \d+–\d+/);
          expect(l).toMatch(/roles:/);
        }
      });

      it("leaks no raw dB/LUFS numbers", () => {
        expect(facts).not.toMatch(/-?\d+(\.\d+)?\s?(dbfs|db|lufs)/i);
      });
    });
  }

  it("renders an untitled reference when no metadata is present", () => {
    const f = fixtures[0].input as AbletonBridgeInput;
    expect(renderFacts(f)).toContain("Reference: untitled reference");
  });

  it("renders embedded metadata when present", () => {
    const withMeta: AbletonBridgeInput = {
      ...fixtures[0].input,
      meta: { title: "Nightcall", artist: "Kavinsky", genre: "synthwave", year: 2010 },
    };
    const facts = renderFacts(withMeta);
    expect(facts).toContain("Reference: Nightcall — Kavinsky, synthwave, 2010");
  });

  it("buildOfflinePrompt wraps the facts with ableton-mcp actions", () => {
    const p = buildOfflinePrompt(fixtures[0].input);
    expect(p).toContain("ableton-mcp");
    expect(p).toContain(renderFacts(fixtures[0].input));
    expect(p.toLowerCase()).toContain("batch the operations");
  });
});
