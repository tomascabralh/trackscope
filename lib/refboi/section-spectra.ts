import type { FeatureFrames, Section, SectionLabel } from "../audio/types";

export interface SectionWithSpectra {
  label: SectionLabel;
  startS: number;
  endS: number;
  bandsDb: { sub: number; low: number; mid: number; highMid: number; high: number };
}

const BANDS = ["sub", "low", "mid", "highMid", "high"] as const;
const EPS = 1e-9;

function toDb(linear: number): number {
  const db = 20 * Math.log10(linear + EPS);
  return Math.round(db * 10) / 10;
}

export function sectionsWithSpectra(
  sections: Section[],
  features: FeatureFrames
): SectionWithSpectra[] {
  const { times, bands } = features;
  return sections.map((s) => {
    const idx: number[] = [];
    for (let i = 0; i < times.length; i++) {
      if (times[i] >= s.start && times[i] < s.end) idx.push(i);
    }
    // A section always spans frames in practice (boundaries are derived from
    // this same frame grid), so the empty branch is a defensive floor only —
    // it yields the noise-floor dB rather than NaN for a degenerate range.
    const meanDb = (arr: Float32Array) =>
      idx.length === 0
        ? toDb(0)
        : toDb(idx.reduce((sum, i) => sum + arr[i], 0) / idx.length);
    const bandsDb = Object.fromEntries(
      BANDS.map((b) => [b, meanDb(bands[b])])
    ) as SectionWithSpectra["bandsDb"];
    return { label: s.label, startS: s.start, endS: s.end, bandsDb };
  });
}
