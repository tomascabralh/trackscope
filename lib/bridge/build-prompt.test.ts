import { describe, it, expect } from "vitest";
import { buildAbletonPrompt } from "./build-prompt";
import { fixtures } from "../breakdown/__fixtures__";

describe("buildAbletonPrompt", () => {
  for (const { id, input } of fixtures) {
    describe(id, () => {
      const prompt = buildAbletonPrompt(input);

      it("states tempo and key", () => {
        expect(prompt).toContain(`Tempo: ${input.bpm} BPM`);
        expect(prompt).toContain(`Key: ${input.key}`);
      });

      it("has one ordered arrangement line per section with a bar range", () => {
        const lines = prompt
          .split("\n")
          .filter((l) => /^\d+\.\s/.test(l.trim()));
        expect(lines).toHaveLength(input.sections.length);
        for (const l of lines) expect(l).toMatch(/bars \d+–\d+/);
      });

      it("leaks no raw dB/LUFS numbers", () => {
        expect(prompt).not.toMatch(/-?\d+(\.\d+)?\s?(dbfs|db|lufs)/i);
      });

      it("anchors placeholders to the key's root note", () => {
        const root = input.key.split(" ")[0];
        expect(prompt).toMatch(new RegExp(`${root.replace("#", "\\#")}\\d`));
      });
    });
  }

  it("matches the golden house-peaktime prompt", () => {
    const house = fixtures.find((f) => f.id === "house-peaktime")!;
    expect(buildAbletonPrompt(house.input)).toMatchSnapshot();
  });
});
