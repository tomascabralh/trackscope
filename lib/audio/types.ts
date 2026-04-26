export type SectionLabel =
  | "intro"
  | "buildup"
  | "drop"
  | "breakdown"
  | "verse"
  | "outro";

export interface Section {
  start: number;
  end: number;
  label: SectionLabel;
}

export interface BandFrame {
  time: number;
  sub: number;
  low: number;
  mid: number;
  highMid: number;
  high: number;
}

export interface FeatureFrames {
  frameSize: number;
  hopSize: number;
  hopSeconds: number;
  times: Float32Array;
  rms: Float32Array;
  bands: {
    sub: Float32Array;
    low: Float32Array;
    mid: Float32Array;
    highMid: Float32Array;
    high: Float32Array;
  };
}

export interface AnalysisResult {
  bpm: number;
  key: string;
  lufs: number;
  sections: Section[];
  features: FeatureFrames;
  monoData: Float32Array;
  sampleRate: number;
  durationS: number;
  originalSampleRate: number;
  originalChannels: number;
}

export interface TrackMetadata {
  title?: string;
  artist?: string;
  album?: string;
  year?: number;
  genre?: string;
  trackNumber?: number;
  bitrateKbps?: number;
  codec?: string;
  container?: string;
  coverDataUrl?: string;
  fileName: string;
  fileSizeBytes: number;
}
