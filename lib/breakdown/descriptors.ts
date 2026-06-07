import type { SectionWithSpectra } from "./section-spectra";

/**
 * Translates raw per-section band dB into relative, producer-readable
 * descriptors. The breakdown model is handed these words instead of numbers —
 * it can't quote dB/LUFS back at you if it never sees them, and relative
 * language ("sub dominant, mids scooped") is what a producer actually wants.
 *
 * Two reference frames:
 * - band tilt: each band vs the section's own mean across bands (the spectral
 *   shape — sub-led, scooped, bright).
 * - energy: each section's overall level vs the duration-weighted track mean
 *   (the arc — which sections hit hardest, where the sub drops out).
 */

const BANDS = ["sub", "low", "mid", "highMid", "high"] as const;
type BandKey = (typeof BANDS)[number];

export type BandDescriptor =
  | "dominant"
  | "forward"
  | "present"
  | "back"
  | "recessed"
  | "absent";

export type EnergyDescriptor = "peak" | "high" | "mid" | "low" | "sparse";

export interface SectionDescriptors {
  label: SectionWithSpectra["label"];
  startS: number;
  endS: number;
  energy: EnergyDescriptor;
  bands: Record<BandKey, BandDescriptor>;
}

/** Band level relative to the section's mean across bands, in dB. */
function bandDescriptor(deltaDb: number): BandDescriptor {
  if (deltaDb >= 6) return "dominant";
  if (deltaDb >= 2) return "forward";
  if (deltaDb > -2) return "present";
  if (deltaDb > -6) return "back";
  if (deltaDb > -12) return "recessed";
  return "absent";
}

/** Section level relative to the track's duration-weighted mean, in dB. */
function energyDescriptor(deltaDb: number): EnergyDescriptor {
  if (deltaDb >= 4) return "peak";
  if (deltaDb >= 1.5) return "high";
  if (deltaDb > -1.5) return "mid";
  if (deltaDb > -4) return "low";
  return "sparse";
}

const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

export function describeSections(
  sections: SectionWithSpectra[]
): SectionDescriptors[] {
  if (sections.length === 0) return [];

  const sectionMeans = sections.map((s) => mean(BANDS.map((b) => s.bandsDb[b])));
  const totalDur = sections.reduce((sum, s) => sum + (s.endS - s.startS), 0) || 1;
  const trackMean =
    sections.reduce(
      (sum, s, i) => sum + sectionMeans[i] * (s.endS - s.startS),
      0
    ) / totalDur;

  return sections.map((s, i) => {
    const sectionMean = sectionMeans[i];
    const bands = Object.fromEntries(
      BANDS.map((b) => [b, bandDescriptor(s.bandsDb[b] - sectionMean)])
    ) as Record<BandKey, BandDescriptor>;
    return {
      label: s.label,
      startS: s.startS,
      endS: s.endS,
      energy: energyDescriptor(sectionMean - trackMean),
      bands,
    };
  });
}

export function describeLoudness(lufs: number): string {
  if (lufs >= -7) return "hot, heavily mastered";
  if (lufs >= -9) return "loud, mastered";
  if (lufs >= -12) return "moderate headroom";
  if (lufs >= -16) return "dynamic";
  return "very dynamic, quiet master";
}
