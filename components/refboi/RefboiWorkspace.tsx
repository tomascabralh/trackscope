"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { analyzeAudio } from "@/lib/audio/analyze";
import { parseTrackMetadata } from "@/lib/audio/metadata";
import { bandsToChartSeries } from "@/lib/audio/spectral";
import type {
  AnalysisPhase,
  AnalysisProgress,
  AnalysisResult,
  TrackMetadata,
} from "@/lib/audio/types";
import Uploader from "./Uploader";
import ResultsPanel from "./ResultsPanel";
import TrackInfo from "./TrackInfo";
import WaveformTimeline from "./WaveformTimeline";
import SpectralBands from "./SpectralBands";
import Breakdown from "./Breakdown";
import { sectionsWithSpectra } from "@/lib/refboi/section-spectra";
import type { BreakdownInput } from "@/lib/refboi/breakdown-prompt";

type WorkspaceState =
  | { status: "idle" }
  | { status: "analyzing"; progress: AnalysisProgress | null }
  | {
      status: "done";
      result: AnalysisResult;
      metadata: TrackMetadata;
      peaks: number[];
      audioUrl: string;
    }
  | { status: "error"; message: string };

const PEAK_BUCKETS = 1000;

const PHASE_LABELS: Record<AnalysisPhase, string> = {
  decoding: "decoding audio",
  "loading-essentia": "loading analysis engine",
  "extracting-tempo": "detecting tempo",
  "extracting-key": "detecting key",
  "extracting-loudness": "measuring loudness",
  "extracting-features": "extracting frame features",
  "detecting-sections": "detecting sections",
};

export default function RefboiWorkspace() {
  const [state, setState] = useState<WorkspaceState>({ status: "idle" });

  useEffect(() => {
    return () => {
      if (state.status === "done") URL.revokeObjectURL(state.audioUrl);
    };
  }, [state]);

  async function handleFile(file: File) {
    if (state.status === "done") URL.revokeObjectURL(state.audioUrl);
    setState({ status: "analyzing", progress: null });
    try {
      const [result, metadata] = await Promise.all([
        analyzeAudio(file, (p) =>
          setState((s) => (s.status === "analyzing" ? { ...s, progress: p } : s))
        ),
        parseTrackMetadata(file),
      ]);
      const peaks = peaksFromMono(result.monoData, PEAK_BUCKETS);
      const audioUrl = URL.createObjectURL(file);
      setState({ status: "done", result, metadata, peaks, audioUrl });
    } catch (err) {
      setState({
        status: "error",
        message: err instanceof Error ? err.message : "Analysis failed",
      });
    }
  }

  const series = useMemo(
    () => (state.status === "done" ? bandsToChartSeries(state.result.features) : []),
    [state]
  );

  const breakdownInput = useMemo<BreakdownInput | null>(() => {
    if (state.status !== "done") return null;
    return {
      bpm: state.result.bpm,
      key: state.result.key,
      lufs: state.result.lufs,
      durationS: state.result.durationS,
      sections: sectionsWithSpectra(state.result.sections, state.result.features),
    };
  }, [state]);

  return (
    <div style={{ fontFamily: "monospace", padding: "2rem", maxWidth: 960 }}>
      <Link
        href="/"
        aria-label="back to home"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "0.4rem",
          color: "#888",
          textDecoration: "none",
          fontSize: 13,
          marginBottom: "0.5rem",
        }}
      >
        <span aria-hidden="true">←</span>
        <span>home</span>
      </Link>

      <h1>refboi</h1>

      <Uploader onFile={handleFile} />

      {state.status === "analyzing" && <Loader progress={state.progress} />}

      {state.status === "error" && <p style={{ color: "red" }}>{state.message}</p>}

      {state.status === "done" && (
        <>
          <TrackInfo
            metadata={state.metadata}
            durationS={state.result.durationS}
            originalSampleRate={state.result.originalSampleRate}
            originalChannels={state.result.originalChannels}
          />
          <ResultsPanel
            bpm={state.result.bpm}
            musicalKey={state.result.key}
            lufs={state.result.lufs}
          />
          <WaveformTimeline
            peaks={state.peaks}
            durationS={state.result.durationS}
            sections={state.result.sections}
            audioUrl={state.audioUrl}
          />
          <SpectralBands
            series={series}
            durationS={state.result.durationS}
            sections={state.result.sections}
          />
          {breakdownInput && <Breakdown input={breakdownInput} />}
        </>
      )}
    </div>
  );
}

function Loader({ progress }: { progress: AnalysisProgress | null }) {
  const fraction = progress?.fraction ?? 0;
  const label = progress ? PHASE_LABELS[progress.phase] : "preparing";
  const pct = Math.round(fraction * 100);

  return (
    <div style={{ marginBottom: "1.5rem" }}>
      <div
        style={{
          width: "100%",
          height: 6,
          background: "#1a1a1a",
          border: "1px solid #2a2a2a",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: `${pct}%`,
            height: "100%",
            background: "#888",
            transition: "width 120ms linear",
          }}
        />
      </div>
      <div
        style={{
          marginTop: "0.4rem",
          display: "flex",
          justifyContent: "space-between",
          fontSize: 12,
          color: "#888",
        }}
      >
        <span>{label}…</span>
        <span>{pct}%</span>
      </div>
    </div>
  );
}

function peaksFromMono(mono: Float32Array, buckets: number): number[] {
  const out = new Array<number>(buckets);
  const step = mono.length / buckets;
  for (let i = 0; i < buckets; i++) {
    const start = Math.floor(i * step);
    const end = Math.floor((i + 1) * step);
    let m = 0;
    for (let j = start; j < end; j++) {
      const v = Math.abs(mono[j]);
      if (v > m) m = v;
    }
    out[i] = m;
  }
  return out;
}
