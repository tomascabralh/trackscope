import type { BandFrame, FeatureFrames } from "./types";

const TARGET_POINTS = 400;

export function bandsToChartSeries(features: FeatureFrames): BandFrame[] {
  const { times, bands } = features;
  const n = times.length;
  if (n === 0) return [];

  const step = Math.max(1, Math.floor(n / TARGET_POINTS));
  const maxes = {
    sub: maxOf(bands.sub),
    low: maxOf(bands.low),
    mid: maxOf(bands.mid),
    highMid: maxOf(bands.highMid),
    high: maxOf(bands.high),
  };

  const out: BandFrame[] = [];
  for (let i = 0; i < n; i += step) {
    out.push({
      time: times[i],
      sub: maxes.sub === 0 ? 0 : bands.sub[i] / maxes.sub,
      low: maxes.low === 0 ? 0 : bands.low[i] / maxes.low,
      mid: maxes.mid === 0 ? 0 : bands.mid[i] / maxes.mid,
      highMid: maxes.highMid === 0 ? 0 : bands.highMid[i] / maxes.highMid,
      high: maxes.high === 0 ? 0 : bands.high[i] / maxes.high,
    });
  }
  return out;
}

function maxOf(arr: Float32Array): number {
  let m = 0;
  for (let i = 0; i < arr.length; i++) if (arr[i] > m) m = arr[i];
  return m;
}
