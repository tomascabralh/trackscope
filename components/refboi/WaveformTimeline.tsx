"use client";

import { useEffect, useRef } from "react";
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

  useEffect(() => {
    if (!containerRef.current) return;
    let destroyed = false;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let ws: any = null;

    (async () => {
      const [{ default: WaveSurfer }, { default: RegionsPlugin }] = await Promise.all([
        import("wavesurfer.js"),
        import("wavesurfer.js/dist/plugins/regions.esm.js"),
      ]);
      if (destroyed || !containerRef.current) return;

      const regionsPlugin = RegionsPlugin.create();
      ws = WaveSurfer.create({
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
        plugins: [regionsPlugin],
      });

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
    })();

    return () => {
      destroyed = true;
      if (ws) ws.destroy();
    };
  }, [peaks, durationS, sections, audioUrl]);

  return (
    <div style={{ marginBottom: "1.5rem" }}>
      <div
        ref={containerRef}
        onClick={(e) => {
          const target = e.currentTarget.querySelector("audio") as HTMLAudioElement | null;
          if (target?.paused) target.play();
          else target?.pause();
        }}
        style={{ cursor: "pointer", background: "#0a0a0a", padding: "8px" }}
      />
    </div>
  );
}
