import { decodeToMono22k } from "./decode";
import { getEssentia } from "./essentia";
import { extractFrameFeatures } from "./features";
import { detectSections } from "./sections";
import type { AnalysisResult } from "./types";

export type { AnalysisResult } from "./types";

export async function analyzeAudio(file: File): Promise<AnalysisResult> {
  const {
    monoData,
    sampleRate,
    durationS,
    originalSampleRate,
    originalChannels,
  } = await decodeToMono22k(file);
  const essentia = await getEssentia();

  const bpmVector = essentia.arrayToVector(monoData);
  const rhythm = essentia.RhythmExtractor2013(bpmVector);
  const bpm = Math.round(rhythm.bpm * 10) / 10;

  const keyVector = essentia.arrayToVector(monoData);
  const keyResult = essentia.KeyExtractor(
    keyVector,
    true, 4096, 4096, 12, 3500, 60, 25, 0.2, "temperley", sampleRate
  );
  const key = `${keyResult.key} ${keyResult.scale}`;

  const leftVector = essentia.arrayToVector(monoData);
  const rightVector = essentia.arrayToVector(monoData);
  const loudness = essentia.LoudnessEBUR128(
    leftVector, rightVector, 0.1, sampleRate
  );
  const lufs = Math.round(loudness.integratedLoudness * 10) / 10;

  const features = extractFrameFeatures(essentia, monoData, sampleRate);
  const sections = detectSections(features, durationS);

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
