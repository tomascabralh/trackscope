import type { FeatureFrames } from "./types";

const FRAME_SIZE = 4096;
const HOP_SIZE = 2048;

const BAND_RANGES = {
  sub: [20, 60],
  low: [60, 250],
  mid: [250, 2000],
  highMid: [2000, 6000],
  high: [6000, 11000],
} as const;

type BandKey = keyof typeof BAND_RANGES;

export function extractFrameFeatures(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  essentia: any,
  monoData: Float32Array,
  sampleRate: number
): FeatureFrames {
  const frames = essentia.FrameGenerator(monoData, FRAME_SIZE, HOP_SIZE);
  const frameCount = frames.size();

  const times = new Float32Array(frameCount);
  const rms = new Float32Array(frameCount);
  const bands = {
    sub: new Float32Array(frameCount),
    low: new Float32Array(frameCount),
    mid: new Float32Array(frameCount),
    highMid: new Float32Array(frameCount),
    high: new Float32Array(frameCount),
  };
  const hopSeconds = HOP_SIZE / sampleRate;

  for (let i = 0; i < frameCount; i++) {
    const frame = frames.get(i);

    times[i] = (i * HOP_SIZE + FRAME_SIZE / 2) / sampleRate;
    rms[i] = essentia.RMS(frame).rms;

    const windowed = essentia.Windowing(frame, false, FRAME_SIZE, "hann").frame;
    const spectrum = essentia.Spectrum(windowed, FRAME_SIZE).spectrum;

    for (const key of Object.keys(BAND_RANGES) as BandKey[]) {
      const [lo, hi] = BAND_RANGES[key];
      bands[key][i] = essentia.EnergyBand(spectrum, sampleRate, lo, hi).energyBand;
    }
  }

  frames.delete?.();

  return {
    frameSize: FRAME_SIZE,
    hopSize: HOP_SIZE,
    hopSeconds,
    times,
    rms,
    bands,
  };
}
