import { describe, it, expect } from "vitest";
import { sectionsToBars } from "./bars";
import type { SectionWithSpectra } from "../breakdown/section-spectra";

const z = { sub: 0, low: 0, mid: 0, highMid: 0, high: 0 };
const at = (
  label: SectionWithSpectra["label"],
  startS: number,
  endS: number
): SectionWithSpectra => ({ label, startS, endS, bandsDb: z });

describe("sectionsToBars", () => {
  it("snaps boundaries to a 4-bar grid and tiles contiguously from bar 1", () => {
    // 126 BPM: 0.525 bars/sec
    const out = sectionsToBars(
      [
        at("intro", 0, 32),
        at("buildup", 32, 64),
        at("drop", 64, 160),
        at("breakdown", 160, 208),
        at("drop", 208, 320),
        at("outro", 320, 372),
      ],
      126
    );
    expect(out).toEqual([
      { label: "intro", startBar: 1, endBar: 16, lengthBars: 16 },
      { label: "buildup", startBar: 17, endBar: 32, lengthBars: 16 },
      { label: "drop", startBar: 33, endBar: 84, lengthBars: 52 },
      { label: "breakdown", startBar: 85, endBar: 108, lengthBars: 24 },
      { label: "drop", startBar: 109, endBar: 168, lengthBars: 60 },
      { label: "outro", startBar: 169, endBar: 196, lengthBars: 28 },
    ]);
  });

  it("enforces a 4-bar minimum when a section would snap to nothing", () => {
    // a 1s blip at 126 BPM snaps toward 0 bars -> floored to 4
    const out = sectionsToBars([at("intro", 0, 1), at("drop", 1, 60)], 126);
    expect(out[0]).toEqual({
      label: "intro",
      startBar: 1,
      endBar: 4,
      lengthBars: 4,
    });
    expect(out[1].startBar).toBe(5);
  });

  it("returns [] for no sections", () => {
    expect(sectionsToBars([], 126)).toEqual([]);
  });
});
