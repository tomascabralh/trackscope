"use client";

import { useEffect, useMemo, useState } from "react";
import { analyzeAudio } from "@/lib/audio/analyze";
import { bandsToChartSeries } from "@/lib/audio/spectral";
import type { AnalysisResult } from "@/lib/audio/types";
import Uploader from "./Uploader";
import ResultsPanel from "./ResultsPanel";
import WaveformTimeline from "./WaveformTimeline";
import SpectralBands from "./SpectralBands";

type WorkspaceState =
  | { status: "idle" }
  | { status: "analyzing" }
  | {
      status: "done";
      result: AnalysisResult;
      peaks: number[];
      audioUrl: string;
    }
  | { status: "error"; message: string };

const PEAK_BUCKETS = 1000;

export default function RefboiWorkspace() {
  const [state, setState] = useState<WorkspaceState>({ status: "idle" });

  useEffect(() => {
    return () => {
      if (state.status === "done") URL.revokeObjectURL(state.audioUrl);
    };
  }, [state]);

  async function handleFile(file: File) {
    if (state.status === "done") URL.revokeObjectURL(state.audioUrl);
    setState({ status: "analyzing" });
    try {
      const result = await analyzeAudio(file);
      const peaks = peaksFromMono(result.monoData, PEAK_BUCKETS);
      const audioUrl = URL.createObjectURL(file);
      setState({ status: "done", result, peaks, audioUrl });
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

  return (
    <div style={{ fontFamily: "monospace", padding: "2rem", maxWidth: 960 }}>
      <h1>refboi</h1>

      <Uploader onFile={handleFile} />

      {state.status === "analyzing" && <p>analyzing…</p>}

      {state.status === "error" && <p style={{ color: "red" }}>{state.message}</p>}

      {state.status === "done" && (
        <>
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
        </>
      )}
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
