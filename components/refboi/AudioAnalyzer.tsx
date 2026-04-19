"use client";

import { useRef, useState } from "react";
import { analyzeAudio, type AnalysisResult } from "@/lib/audio/analyze";

type State =
  | { status: "idle" }
  | { status: "analyzing" }
  | { status: "done"; result: AnalysisResult }
  | { status: "error"; message: string };

export default function AudioAnalyzer() {
  const [state, setState] = useState<State>({ status: "idle" });
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    setState({ status: "analyzing" });
    try {
      const result = await analyzeAudio(file);
      setState({ status: "done", result });
    } catch (err) {
      setState({
        status: "error",
        message: err instanceof Error ? err.message : "Analysis failed",
      });
    }
  }

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }

  return (
    <div style={{ fontFamily: "monospace", padding: "2rem", maxWidth: 480 }}>
      <h1>refboi</h1>

      <div
        onDrop={onDrop}
        onDragOver={(e) => e.preventDefault()}
        onClick={() => inputRef.current?.click()}
        style={{
          border: "2px dashed #888",
          padding: "2rem",
          cursor: "pointer",
          textAlign: "center",
          marginBottom: "1.5rem",
        }}
      >
        drop mp3 / wav here, or click to browse
        <input
          ref={inputRef}
          type="file"
          accept=".mp3,.wav,audio/mpeg,audio/wav"
          style={{ display: "none" }}
          onChange={onFileChange}
        />
      </div>

      {state.status === "analyzing" && <p>analyzing…</p>}

      {state.status === "error" && (
        <p style={{ color: "red" }}>{state.message}</p>
      )}

      {state.status === "done" && (
        <table style={{ borderCollapse: "collapse", width: "100%" }}>
          <tbody>
            <tr>
              <td style={{ padding: "0.25rem 1rem 0.25rem 0" }}>BPM</td>
              <td>{state.result.bpm}</td>
            </tr>
            <tr>
              <td style={{ padding: "0.25rem 1rem 0.25rem 0" }}>Key</td>
              <td>{state.result.key}</td>
            </tr>
            <tr>
              <td style={{ padding: "0.25rem 1rem 0.25rem 0" }}>LUFS</td>
              <td>{state.result.lufs} LUFS</td>
            </tr>
          </tbody>
        </table>
      )}
    </div>
  );
}
