import { describe, it, expect } from "vitest";
import { buildBreakdownMessages, type BreakdownInput } from "./breakdown-prompt";

const input: BreakdownInput = {
  bpm: 128,
  key: "F# minor",
  lufs: -8.2,
  durationS: 200,
  sections: [
    { label: "intro", startS: 0, endS: 18, bandsDb: { sub: -30, low: -20, mid: -18, highMid: -22, high: -28 } },
    { label: "drop", startS: 18, endS: 80, bandsDb: { sub: -6, low: -5, mid: -8, highMid: -10, high: -12 } },
  ],
};

describe("buildBreakdownMessages", () => {
  it("marks the system block as cacheable", () => {
    const { system } = buildBreakdownMessages(input);
    expect(system[0].cache_control).toEqual({ type: "ephemeral" });
    expect(system[0].text.toLowerCase()).toContain("## overall");
  });

  it("renders sections with mm:ss ranges and band labels in the user message", () => {
    const { messages } = buildBreakdownMessages(input);
    const text = messages[0].content as string;
    expect(text).toContain("128"); // bpm
    expect(text).toContain("F# minor");
    expect(text).toContain("0:00–0:18"); // intro range (en-dash U+2013)
    expect(text).toContain("0:18–1:20"); // drop range (en-dash U+2013)
    expect(text).toMatch(/drop/i);
  });
});
