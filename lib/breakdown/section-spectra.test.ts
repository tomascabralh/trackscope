import { describe, it, expect } from "vitest";
import { sectionsWithSpectra } from "./section-spectra";
import type { FeatureFrames, Section } from "../audio/types";

function frames(times: number[], band: number[]): FeatureFrames {
  const f = (a: number[]) => Float32Array.from(a);
  return {
    frameSize: 2048,
    hopSize: 1024,
    hopSeconds: 1,
    times: f(times),
    rms: f(band),
    bands: { sub: f(band), low: f(band), mid: f(band), highMid: f(band), high: f(band) },
  };
}

describe("sectionsWithSpectra", () => {
  it("averages linear RMS per section, then converts to dB", () => {
    const features = frames([0, 1, 2, 3], [1, 1, 0.1, 0.1]);
    const sections: Section[] = [
      { start: 0, end: 2, label: "intro" },
      { start: 2, end: 4, label: "drop" },
    ];
    const out = sectionsWithSpectra(sections, features);
    expect(out).toHaveLength(2);
    expect(out[0]).toMatchObject({ label: "intro", startS: 0, endS: 2 });
    expect(out[0].bandsDb.sub).toBeCloseTo(0, 1);
    expect(out[1].bandsDb.sub).toBeCloseTo(-20, 1);
  });

  it("handles a section with no frames without NaN", () => {
    const features = frames([0, 1], [1, 1]);
    const sections: Section[] = [{ start: 5, end: 9, label: "outro" }];
    const out = sectionsWithSpectra(sections, features);
    expect(Number.isFinite(out[0].bandsDb.sub)).toBe(true);
  });
});
