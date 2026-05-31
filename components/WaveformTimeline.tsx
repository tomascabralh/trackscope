"use client";

import { useEffect, useRef, useState } from "react";
import type { Section, SectionLabel } from "@/lib/audio/types";

interface WaveformTimelineProps {
  peaks: number[];
  durationS: number;
  sections: Section[];
  audioUrl: string;
}

const SECTION_COLORS: Record<SectionLabel, string> = {
  intro: "rgba(120, 120, 120, 0.25)",
  buildup: "rgba(217, 119, 6, 0.3)",
  drop: "rgba(220, 38, 38, 0.35)",
  breakdown: "rgba(37, 99, 235, 0.3)",
  verse: "rgba(22, 163, 74, 0.25)",
  outro: "rgba(120, 120, 120, 0.25)",
};

export default function WaveformTimeline({
  peaks,
  durationS,
  sections,
  audioUrl,
}: WaveformTimelineProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const wsRef = useRef<any>(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);

  useEffect(() => {
    if (!containerRef.current) return;
    let destroyed = false;

    (async () => {
      const [{ default: WaveSurfer }, { default: RegionsPlugin }] = await Promise.all([
        import("wavesurfer.js"),
        import("wavesurfer.js/dist/plugins/regions.esm.js"),
      ]);
      if (destroyed || !containerRef.current) return;

      const regionsPlugin = RegionsPlugin.create();
      const ws = WaveSurfer.create({
        container: containerRef.current,
        url: audioUrl,
        peaks: [peaks],
        duration: durationS,
        height: 96,
        waveColor: "#555",
        progressColor: "#bbb",
        cursorColor: "#fff",
        cursorWidth: 1,
        normalize: true,
        dragToSeek: true,
        plugins: [regionsPlugin],
      });
      wsRef.current = ws;

      for (const s of sections) {
        regionsPlugin.addRegion({
          start: s.start,
          end: s.end,
          color: SECTION_COLORS[s.label],
          content: s.label,
          drag: false,
          resize: false,
        });
      }

      ws.on("play", () => setPlaying(true));
      ws.on("pause", () => setPlaying(false));
      ws.on("finish", () => setPlaying(false));
      ws.on("timeupdate", (t: number) => setCurrentTime(t));
    })();

    return () => {
      destroyed = true;
      wsRef.current?.destroy();
      wsRef.current = null;
    };
  }, [peaks, durationS, sections, audioUrl]);

  function togglePlay() {
    wsRef.current?.playPause();
  }

  function restart() {
    wsRef.current?.seekTo(0);
  }

  return (
    <div style={{ marginBottom: "1.5rem" }}>
      <div ref={containerRef} style={{ background: "#0a0a0a", padding: "8px" }} />
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "0.75rem",
          marginTop: "0.5rem",
          fontFamily: "monospace",
          fontSize: 13,
        }}
      >
        <button
          onClick={togglePlay}
          style={{
            padding: "0.35rem 0.9rem",
            background: "#1a1a1a",
            border: "1px solid #444",
            color: "#eee",
            cursor: "pointer",
            fontFamily: "inherit",
            fontSize: "inherit",
          }}
        >
          {playing ? "pause" : "play"}
        </button>
        <button
          onClick={restart}
          style={{
            padding: "0.35rem 0.9rem",
            background: "#1a1a1a",
            border: "1px solid #444",
            color: "#eee",
            cursor: "pointer",
            fontFamily: "inherit",
            fontSize: "inherit",
          }}
        >
          restart
        </button>
        <span style={{ color: "#888" }}>
          {formatTime(currentTime)} / {formatTime(durationS)}
        </span>
        <span style={{ color: "#555", fontSize: 11 }}>
          click or drag the waveform to seek
        </span>
      </div>
    </div>
  );
}

function formatTime(s: number): string {
  const m = Math.floor(s / 60);
  const r = Math.floor(s % 60);
  return `${m}:${r.toString().padStart(2, "0")}`;
}
