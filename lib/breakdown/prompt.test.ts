import { describe, it, expect } from "vitest";
import { buildBreakdownMessages, type BreakdownInput } from "./prompt";
import { fixtures } from "./__fixtures__";

const mmss = (s: number) =>
  `${Math.floor(Math.round(s) / 60)}:${String(Math.round(s) % 60).padStart(2, "0")}`;

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

describe("buildBreakdownMessages — fixture contract", () => {
  it("has fixtures spanning distinct profiles", () => {
    expect(fixtures.length).toBeGreaterThanOrEqual(3);
    expect(new Set(fixtures.map((f) => f.id)).size).toBe(fixtures.length);
  });

  for (const { id, input } of fixtures) {
    describe(id, () => {
      it("keeps the ## Overall instruction in the system prompt", () => {
        const { system } = buildBreakdownMessages(input);
        expect(system.toLowerCase()).toContain("## overall");
      });

      it("renders the track-feature facts", () => {
        const { user } = buildBreakdownMessages(input);
        expect(user).toContain(String(input.bpm));
        expect(user).toContain(input.key);
        expect(user).toContain(String(input.lufs));
      });

      it("renders one mm:ss-keyed line per section, in order", () => {
        const { user } = buildBreakdownMessages(input);
        let cursor = -1;
        for (const s of input.sections) {
          const range = `${mmss(s.startS)}–${mmss(s.endS)}`;
          const at = user.indexOf(range, cursor + 1);
          expect(at, `section ${s.label} ${range} missing or out of order`).toBeGreaterThan(cursor);
          expect(user).toContain(`**${s.label}** (${range})`);
          cursor = at;
        }
      });
    });
  }
});
