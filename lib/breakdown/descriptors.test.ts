import { describe, it, expect } from "vitest";
import { describeSections, describeLoudness } from "./descriptors";
import type { SectionWithSpectra } from "./section-spectra";

const sections: SectionWithSpectra[] = [
  { label: "intro", startS: 0, endS: 20, bandsDb: { sub: -30, low: -20, mid: -18, highMid: -22, high: -28 } },
  { label: "drop", startS: 20, endS: 80, bandsDb: { sub: -6, low: -5, mid: -8, highMid: -10, high: -12 } },
];

describe("describeSections", () => {
  const out = describeSections(sections);

  it("keeps label, order, and timing", () => {
    expect(out.map((s) => s.label)).toEqual(["intro", "drop"]);
    expect(out[0].startS).toBe(0);
    expect(out[1].endS).toBe(80);
  });

  it("ranks each band relative to the section's own balance", () => {
    // intro mean across bands = -23.6
    expect(out[0].bands).toEqual({
      sub: "recessed", // -6.4 below section mean
      low: "forward", // +3.6
      mid: "forward", // +5.6
      highMid: "present", // +1.6
      high: "back", // -4.4
    });
    // drop mean across bands = -8.2
    expect(out[1].bands).toEqual({
      sub: "forward", // +2.2
      low: "forward", // +3.2
      mid: "present", // +0.2
      highMid: "present", // -1.8
      high: "back", // -3.8
    });
  });

  it("places each section's loudness on the track-wide energy arc", () => {
    // duration-weighted track mean = -12.05; intro sits far below, drop above
    expect(out[0].energy).toBe("sparse");
    expect(out[1].energy).toBe("high");
  });
});

describe("describeLoudness", () => {
  it("maps LUFS to a headroom word without exposing the number", () => {
    expect(describeLoudness(-6.2)).toBe("hot, heavily mastered");
    expect(describeLoudness(-8.0)).toBe("loud, mastered");
    expect(describeLoudness(-11)).toBe("moderate headroom");
    expect(describeLoudness(-16.4)).toBe("very dynamic, quiet master");
  });
});
