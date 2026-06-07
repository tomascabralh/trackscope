import type { SectionWithSpectra } from "../breakdown/section-spectra";

export interface SectionBars {
  label: SectionWithSpectra["label"];
  /** 1-indexed, inclusive. */
  startBar: number;
  /** 1-indexed, inclusive. */
  endBar: number;
  lengthBars: number;
}

const GRID_BARS = 4;
const MIN_BARS = 4;
const BEATS_PER_BAR = 4;

const snap = (bars: number) => Math.round(bars / GRID_BARS) * GRID_BARS;

export function sectionsToBars(
  sections: SectionWithSpectra[],
  bpm: number
): SectionBars[] {
  if (sections.length === 0) return [];

  const toBars = (seconds: number) => (seconds * bpm) / 60 / BEATS_PER_BAR;
  let prevEnd = 0;

  return sections.map((s) => {
    const end = Math.max(snap(toBars(s.endS)), prevEnd + MIN_BARS);
    const bars: SectionBars = {
      label: s.label,
      startBar: prevEnd + 1,
      endBar: end,
      lengthBars: end - prevEnd,
    };
    prevEnd = end;
    return bars;
  });
}
