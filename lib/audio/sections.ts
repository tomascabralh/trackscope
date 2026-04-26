import type { FeatureFrames, Section, SectionLabel } from "./types";

const SMOOTH_BOUNDARY_FRAMES = 32;
const SMOOTH_LABEL_FRAMES = 96;
const MIN_BOUNDARY_GAP_S = 8;
const MIN_SECTION_LENGTH_S = 4;
const CHANGE_PERCENTILE = 0.9;

export function detectSections(
  features: FeatureFrames,
  durationS: number
): Section[] {
  const { rms, bands, hopSeconds } = features;
  const n = rms.length;
  if (n === 0) return [];

  const logRms = logSeries(rms);
  const logLow = logSeries(bands.low);
  const logHigh = logSeries(bands.high);

  const rmsBoundary = movingAverage(logRms, SMOOTH_BOUNDARY_FRAMES);
  const rmsLabel = movingAverage(logRms, SMOOTH_LABEL_FRAMES);
  const lowLabel = movingAverage(logLow, SMOOTH_LABEL_FRAMES);
  const highLabel = movingAverage(logHigh, SMOOTH_LABEL_FRAMES);

  const p20 = percentile(rmsLabel, 0.2);
  const p50 = percentile(rmsLabel, 0.5);
  const p80 = percentile(rmsLabel, 0.8);
  const lowP80 = percentile(lowLabel, 0.8);

  const boundaryFrames = findBoundaryFrames(rmsBoundary, hopSeconds);

  type RawSeg = {
    startFrame: number;
    endFrame: number;
    startS: number;
    endS: number;
    rMean: number;
    loMean: number;
    rSlope: number;
    hiSlope: number;
  };
  const raw: RawSeg[] = [];
  for (let i = 0; i < boundaryFrames.length - 1; i++) {
    const a = boundaryFrames[i];
    const b = boundaryFrames[i + 1];
    raw.push({
      startFrame: a,
      endFrame: b,
      startS: a * hopSeconds,
      endS: Math.min(b * hopSeconds, durationS),
      rMean: mean(rmsLabel, a, b),
      loMean: mean(lowLabel, a, b),
      rSlope: slope(rmsLabel, a, b),
      hiSlope: slope(highLabel, a, b),
    });
  }

  const labels: (SectionLabel | null)[] = raw.map((seg, i) => {
    const isFirst = i === 0;
    const isLast = i === raw.length - 1;
    if (isFirst && seg.rMean < p50) return "intro";
    if (isLast && seg.rMean < p50) return "outro";
    if (seg.rMean >= p80 && seg.loMean >= lowP80) return "drop";
    return null;
  });

  for (let i = 0; i < raw.length; i++) {
    if (labels[i] !== null) continue;
    const seg = raw[i];
    const prev = labels[i - 1];
    const next = labels[i + 1];
    const adjacentToDrop = prev === "drop" || next === "drop";
    const segDuration = seg.endS - seg.startS;

    if (seg.rMean < p20 && segDuration >= 6 && adjacentToDrop) {
      labels[i] = "breakdown";
    } else if (
      seg.rSlope > 0 &&
      seg.hiSlope > 0 &&
      seg.rMean >= p50 &&
      seg.rMean < p80 &&
      next === "drop"
    ) {
      labels[i] = "buildup";
    } else {
      labels[i] = "verse";
    }
  }

  let sections: Section[] = raw.map((seg, i) => ({
    start: seg.startS,
    end: seg.endS,
    label: labels[i] ?? "verse",
  }));

  sections = mergeAdjacent(sections);
  sections = mergeShortSections(sections, rmsLabel, hopSeconds);
  sections = mergeAdjacent(sections);

  return sections;
}

function logSeries(arr: Float32Array): Float32Array {
  const out = new Float32Array(arr.length);
  for (let i = 0; i < arr.length; i++) out[i] = Math.log(arr[i] + 1e-9);
  return out;
}

function movingAverage(arr: Float32Array, window: number): Float32Array {
  const n = arr.length;
  const out = new Float32Array(n);
  const half = Math.floor(window / 2);
  let sum = 0;
  let count = 0;
  for (let i = 0; i < Math.min(half, n); i++) {
    sum += arr[i];
    count++;
  }
  for (let i = 0; i < n; i++) {
    const addIdx = i + half;
    const dropIdx = i - half - 1;
    if (addIdx < n) {
      sum += arr[addIdx];
      count++;
    }
    if (dropIdx >= 0) {
      sum -= arr[dropIdx];
      count--;
    }
    out[i] = sum / count;
  }
  return out;
}

function percentile(arr: Float32Array, p: number): number {
  const sorted = Array.from(arr).sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.floor(p * sorted.length));
  return sorted[idx];
}

function mean(arr: Float32Array, start: number, end: number): number {
  if (end <= start) return arr[start] ?? 0;
  let s = 0;
  for (let i = start; i < end; i++) s += arr[i];
  return s / (end - start);
}

function slope(arr: Float32Array, start: number, end: number): number {
  const n = end - start;
  if (n < 2) return 0;
  let sumX = 0,
    sumY = 0,
    sumXY = 0,
    sumX2 = 0;
  for (let i = 0; i < n; i++) {
    const x = i;
    const y = arr[start + i];
    sumX += x;
    sumY += y;
    sumXY += x * y;
    sumX2 += x * x;
  }
  const denom = n * sumX2 - sumX * sumX;
  if (denom === 0) return 0;
  return (n * sumXY - sumX * sumY) / denom;
}

function findBoundaryFrames(rms: Float32Array, hopSeconds: number): number[] {
  const n = rms.length;
  if (n < 3) return [0, n];

  const change = new Float32Array(n);
  for (let i = 1; i < n; i++) change[i] = Math.abs(rms[i] - rms[i - 1]);
  const threshold = percentile(change, CHANGE_PERCENTILE);
  const minGapFrames = Math.max(1, Math.round(MIN_BOUNDARY_GAP_S / hopSeconds));

  const candidates: number[] = [0];
  let lastBoundary = 0;
  for (let i = 1; i < n - 1; i++) {
    if (change[i] < threshold) continue;
    if (change[i] < change[i - 1] || change[i] < change[i + 1]) continue;
    if (i - lastBoundary < minGapFrames) continue;
    candidates.push(i);
    lastBoundary = i;
  }
  candidates.push(n);
  return candidates;
}

function mergeAdjacent(sections: Section[]): Section[] {
  if (sections.length === 0) return sections;
  const out: Section[] = [sections[0]];
  for (let i = 1; i < sections.length; i++) {
    const last = out[out.length - 1];
    if (last.label === sections[i].label) {
      last.end = sections[i].end;
    } else {
      out.push(sections[i]);
    }
  }
  return out;
}

function mergeShortSections(
  sections: Section[],
  rms: Float32Array,
  hopSeconds: number
): Section[] {
  if (sections.length <= 1) return sections;
  const result = sections.slice();
  let i = 0;
  while (i < result.length) {
    const seg = result[i];
    if (seg.end - seg.start >= MIN_SECTION_LENGTH_S || result.length === 1) {
      i++;
      continue;
    }
    const prev = result[i - 1];
    const next = result[i + 1];
    const louderNeighbor = pickLouder(seg, prev, next, rms, hopSeconds);
    if (louderNeighbor === "prev" && prev) {
      prev.end = seg.end;
      result.splice(i, 1);
    } else if (louderNeighbor === "next" && next) {
      next.start = seg.start;
      result.splice(i, 1);
    } else {
      i++;
    }
  }
  return result;
}

function pickLouder(
  seg: Section,
  prev: Section | undefined,
  next: Section | undefined,
  rms: Float32Array,
  hopSeconds: number
): "prev" | "next" | null {
  if (!prev && !next) return null;
  if (!prev) return "next";
  if (!next) return "prev";
  const prevMean = mean(
    rms,
    Math.floor(prev.start / hopSeconds),
    Math.floor(prev.end / hopSeconds)
  );
  const nextMean = mean(
    rms,
    Math.floor(next.start / hopSeconds),
    Math.floor(next.end / hopSeconds)
  );
  return prevMean >= nextMean ? "prev" : "next";
}
