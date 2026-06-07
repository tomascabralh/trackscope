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

      it("anchors pitched tracks to the key's root note", () => {
        const root = input.key.split(" ")[0];
        const line = facts.split("\n").find((l) => l.startsWith("Root-note anchors"));
        expect(line).toBeDefined();
        expect(line).toMatch(new RegExp(`${root.replace("#", "\\#")}\\d`));
      });
    });
  }

  it("renders root-note anchors with per-role octaves (house, A minor)", () => {
    const house = fixtures.find((f) => f.id === "house-peaktime")!.input;
    expect(renderFacts(house)).toContain(
      "Root-note anchors (key A minor): Sub A1, Bass A2, Lead A3, Pad A3"
    );
  });

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

  it("buildOfflinePrompt frames the facts with an intro and a closing action", () => {
    const input = fixtures[0].input;
    const p = buildOfflinePrompt(input);
    const facts = renderFacts(input);
    expect(p).toContain("You are building a starting-point Ableton Live project");
    expect(p).toContain("ableton-mcp tools");
    expect(p).toContain(facts);
    expect(p.indexOf("You are building")).toBeLessThan(p.indexOf(facts));
    expect(p.trimEnd().endsWith("batch the operations.")).toBe(true);
  });
});
