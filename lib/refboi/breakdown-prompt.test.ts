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
  it("puts the output contract in the system string", () => {
    const { system } = buildBreakdownMessages(input);
    expect(typeof system).toBe("string");
    expect(system.toLowerCase()).toContain("## overall");
  });

  it("renders sections with mm:ss ranges and band labels in the user string", () => {
    const { user } = buildBreakdownMessages(input);
    expect(user).toContain("128"); // bpm
    expect(user).toContain("F# minor");
    expect(user).toContain("0:00–0:18"); // intro range (en-dash)
    expect(user).toContain("0:18–1:20"); // drop range (en-dash)
    expect(user).toMatch(/drop/i);
  });
});
