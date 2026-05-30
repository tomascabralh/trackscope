"use client";

import type { BandFrame, Section } from "@/lib/audio/types";

interface SpectralBandsProps {
  series: BandFrame[];
  durationS: number;
  sections?: Section[];
}

const BANDS: { key: keyof Omit<BandFrame, "time">; label: string; color: string }[] = [
  { key: "sub", label: "sub 20–60", color: "#7c3aed" },
  { key: "low", label: "low 60–250", color: "#2563eb" },
  { key: "mid", label: "mid 250–2k", color: "#16a34a" },
  { key: "highMid", label: "high-mid 2k–6k", color: "#d97706" },
  { key: "high", label: "high 6k–11k", color: "#dc2626" },
];

const W = 1000;
const H = 220;
const PAD_L = 40;
const PAD_R = 12;
const PAD_T = 28;
const PAD_B = 24;

export default function SpectralBands({ series, durationS, sections }: SpectralBandsProps) {
  if (series.length === 0 || durationS <= 0) return null;

  const innerW = W - PAD_L - PAD_R;
  const innerH = H - PAD_T - PAD_B;
  const xOf = (t: number) => PAD_L + (t / durationS) * innerW;
  const yOf = (v: number) => PAD_T + (1 - v) * innerH;

  const tickStep = durationS > 240 ? 60 : 30;
  const ticks: number[] = [];
  for (let t = 0; t <= durationS; t += tickStep) ticks.push(t);

  return (
    <div style={{ marginBottom: "1.5rem" }}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        style={{ width: "100%", height: "auto", display: "block" }}
        preserveAspectRatio="none"
      >
        <rect x={PAD_L} y={PAD_T} width={innerW} height={innerH} fill="#0a0a0a" />

        {ticks.map((t) => (
          <g key={t}>
            <line
              x1={xOf(t)}
              x2={xOf(t)}
              y1={PAD_T}
              y2={PAD_T + innerH}
              stroke="#222"
              strokeWidth={1}
            />
            <text
              x={xOf(t)}
              y={H - 8}
              fill="#666"
              fontSize={10}
              fontFamily="monospace"
              textAnchor="middle"
            >
              {formatTime(t)}
            </text>
          </g>
        ))}

        {sections?.map((s, i) => (
          <line
            key={i}
            x1={xOf(s.start)}
            x2={xOf(s.start)}
            y1={PAD_T}
            y2={PAD_T + innerH}
            stroke="#444"
            strokeDasharray="3 3"
            strokeWidth={1}
          />
        ))}

        {BANDS.map((b) => {
          const points = series
            .map((s) => `${xOf(s.time)},${yOf(s[b.key])}`)
            .join(" ");
          return (
            <polyline
              key={b.key}
              points={points}
              fill="none"
              stroke={b.color}
              strokeWidth={1.2}
              strokeLinejoin="round"
            />
          );
        })}

        <g fontFamily="monospace" fontSize={11}>
          {BANDS.map((b, i) => (
            <g key={b.key} transform={`translate(${PAD_L + i * 150}, 16)`}>
              <rect width={10} height={10} fill={b.color} />
              <text x={14} y={9} fill="#aaa">
                {b.label}
              </text>
            </g>
          ))}
        </g>
      </svg>
    </div>
  );
}

function formatTime(s: number): string {
  const m = Math.floor(s / 60);
  const r = Math.floor(s % 60);
  return `${m}:${r.toString().padStart(2, "0")}`;
}
