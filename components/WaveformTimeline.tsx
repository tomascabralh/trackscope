"use client";

import { useEffect, useRef, useState } from "react";
import type { Section, SectionLabel } from "@/lib/audio/types";
import SectionHeading from "./SectionHeading";

interface WaveformTimelineProps {
  peaks: number[];
  durationS: number;
  sections: Section[];
  audioUrl: string;
}

// Translucent tint painted onto the waveform itself.
const SECTION_COLORS: Record<SectionLabel, string> = {
  intro: "rgba(120, 120, 120, 0.18)",
  buildup: "rgba(245, 158, 11, 0.22)",
  drop: "rgba(239, 68, 68, 0.26)",
  breakdown: "rgba(59, 130, 246, 0.22)",
  verse: "rgba(34, 197, 94, 0.16)",
  outro: "rgba(120, 120, 120, 0.18)",
};

// Solid accent for the section-lane labels (matches the spectral legend).
const SECTION_ACCENT: Record<SectionLabel, string> = {
  intro: "#9a9a9a",
  buildup: "#f59e0b",
  drop: "#ef4444",
  breakdown: "#3b82f6",
  verse: "#22c55e",
  outro: "#9a9a9a",
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
        height: 128,
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

  function seekTo(seconds: number) {
    wsRef.current?.setTime(seconds);
  }

  return (
    <div>
      <SectionHeading title="structure" />
      <SectionLane sections={sections} durationS={durationS} onSeek={seekTo} />
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

function SectionLane({
  sections,
  durationS,
  onSeek,
}: {
  sections: Section[];
  durationS: number;
  onSeek: (seconds: number) => void;
}) {
  if (sections.length === 0 || durationS <= 0) return null;

  return (
    <div
      style={{
        display: "flex",
        gap: 2,
        height: 22,
        padding: "0 8px",
        marginBottom: 6,
      }}
    >
      {sections.map((s, i) => {
        const span = Math.max(0.001, s.end - s.start);
        const accent = SECTION_ACCENT[s.label];
        return (
          <button
            key={i}
            onClick={() => onSeek(s.start)}
            title={`${s.label}  ${formatTime(s.start)}–${formatTime(s.end)}`}
            style={{
              flex: `${span} 1 0`,
              // Floor the width so short sections (intro/outro) keep their
              // label legible instead of clipping to "in…".
              minWidth: `${s.label.length + 1.5}ch`,
              height: "100%",
              display: "flex",
              alignItems: "center",
              padding: "0 7px",
              border: "none",
              borderLeft: `2px solid ${accent}`,
              background: SECTION_COLORS[s.label],
              color: accent,
              fontFamily: "inherit",
              fontSize: 11,
              letterSpacing: "0.03em",
              textAlign: "left",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
              cursor: "pointer",
            }}
          >
            {s.label}
          </button>
        );
      })}
    </div>
  );
}

function formatTime(s: number): string {
  const m = Math.floor(s / 60);
  const r = Math.floor(s % 60);
  return `${m}:${r.toString().padStart(2, "0")}`;
}
