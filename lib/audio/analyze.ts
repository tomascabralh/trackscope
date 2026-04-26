import { decodeToMono22k } from "./decode";
import { getEssentia } from "./essentia";
import { extractFrameFeatures } from "./features";
import { detectSections } from "./sections";
import type {
  AnalysisPhase,
  AnalysisResult,
  ProgressCallback,
} from "./types";

export type { AnalysisResult } from "./types";

const PHASE_RANGES: Record<AnalysisPhase, [number, number]> = {
  decoding: [0.0, 0.1],
  "loading-essentia": [0.1, 0.15],
  "extracting-tempo": [0.15, 0.4],
  "extracting-key": [0.4, 0.55],
  "extracting-loudness": [0.55, 0.7],
  "extracting-features": [0.7, 0.95],
  "detecting-sections": [0.95, 1.0],
};

const yieldNow = () => new Promise<void>((r) => setTimeout(r, 0));

export async function analyzeAudio(
  file: File,
  onProgress?: ProgressCallback
): Promise<AnalysisResult> {
  const emit = (phase: AnalysisPhase, sub = 0) => {
    if (!onProgress) return;
    const [start, end] = PHASE_RANGES[phase];
    onProgress({ phase, fraction: start + (end - start) * sub });
  };

  emit("decoding");
  await yieldNow();
  const {
    monoData,
    sampleRate,
    durationS,
    originalSampleRate,
    originalChannels,
  } = await decodeToMono22k(file);
  emit("decoding", 1);

  emit("loading-essentia");
  await yieldNow();
  const essentia = await getEssentia();
  emit("loading-essentia", 1);

  emit("extracting-tempo");
  await yieldNow();
  const bpmVector = essentia.arrayToVector(monoData);
  const rhythm = essentia.RhythmExtractor2013(bpmVector);
  const bpm = Math.round(rhythm.bpm * 10) / 10;
  emit("extracting-tempo", 1);

  emit("extracting-key");
  await yieldNow();
  const keyVector = essentia.arrayToVector(monoData);
  const keyResult = essentia.KeyExtractor(
    keyVector,
    true, 4096, 4096, 12, 3500, 60, 25, 0.2, "temperley", sampleRate
  );
  const key = `${keyResult.key} ${keyResult.scale}`;
  emit("extracting-key", 1);

  emit("extracting-loudness");
  await yieldNow();
  const leftVector = essentia.arrayToVector(monoData);
  const rightVector = essentia.arrayToVector(monoData);
  const loudness = essentia.LoudnessEBUR128(
    leftVector, rightVector, 0.1, sampleRate
  );
  const lufs = Math.round(loudness.integratedLoudness * 10) / 10;
  emit("extracting-loudness", 1);

  emit("extracting-features");
  await yieldNow();
  const features = await extractFrameFeatures(
    essentia,
    monoData,
    sampleRate,
    (f) => emit("extracting-features", f)
  );

  emit("detecting-sections");
  await yieldNow();
  const sections = detectSections(features, durationS);
  emit("detecting-sections", 1);

  return {
    bpm,
    key,
    lufs,
    sections,
    features,
    monoData,
    sampleRate,
    durationS,
    originalSampleRate,
    originalChannels,
  };
}
