"use client";

import type { BandFrame, Section } from "@/lib/audio/types";
import SectionHeading from "./SectionHeading";

interface SpectralBandsProps {
  series: BandFrame[];
  durationS: number;
  sections?: Section[];
}

const BANDS: {
  key: keyof Omit<BandFrame, "time">;
  name: string;
  range: string;
  color: string;
}[] = [
  { key: "sub", name: "sub", range: "20–60", color: "#8b5cf6" },
  { key: "low", name: "low", range: "60–250", color: "#3b82f6" },
  { key: "mid", name: "mid", range: "250–2k", color: "#22c55e" },
  { key: "highMid", name: "high-mid", range: "2k–6k", color: "#f59e0b" },
  { key: "high", name: "high", range: "6k–11k", color: "#ef4444" },
];

const W = 1000;
const PAD_L = 96;
const PAD_R = 16;
const PAD_T = 10;
const LANE_H = 46;
const LANE_GAP = 8;
const AXIS_H = 22;

const LANES_H = BANDS.length * LANE_H + (BANDS.length - 1) * LANE_GAP;
const H = PAD_T + LANES_H + AXIS_H;

export default function SpectralBands({ series, durationS, sections }: SpectralBandsProps) {
  if (series.length === 0 || durationS <= 0) return null;

  const innerW = W - PAD_L - PAD_R;
  const xOf = (t: number) => PAD_L + (t / durationS) * innerW;

  const times = series.map((s) => s.time);
  const k = clamp(Math.round(series.length / 90), 1, 9); // smoothing window

  const tickStep = durationS > 240 ? 60 : 30;
  const ticks: number[] = [];
  for (let t = 0; t <= durationS; t += tickStep) ticks.push(t);

  return (
    <div>
      <SectionHeading title="spectral balance" />
      <svg
        viewBox={`0 0 ${W} ${H}`}
        style={{ width: "100%", height: "auto", display: "block" }}
      >
      {/* section boundary markers, spanning all lanes */}
      {sections?.map((s, i) => (
        <line
          key={`sec-${i}`}
          x1={xOf(s.start)}
          x2={xOf(s.start)}
          y1={PAD_T}
          y2={PAD_T + LANES_H}
          stroke="#333"
          strokeDasharray="3 4"
          strokeWidth={1}
        />
      ))}

      {BANDS.map((b, i) => {
        const top = PAD_T + i * (LANE_H + LANE_GAP);
        const baseline = top + LANE_H;
        const vals = smooth(
          series.map((s) => s[b.key]),
          k
        );

        let area = `M ${xOf(times[0]).toFixed(1)} ${baseline}`;
        let line = "";
        for (let j = 0; j < vals.length; j++) {
          const x = xOf(times[j]).toFixed(1);
          const y = (baseline - vals[j] * (LANE_H - 4)).toFixed(1);
          area += ` L ${x} ${y}`;
          line += `${j === 0 ? "M" : "L"} ${x} ${y} `;
        }
        area += ` L ${xOf(times[times.length - 1]).toFixed(1)} ${baseline} Z`;

        return (
          <g key={b.key}>
            <line x1={PAD_L} x2={W - PAD_R} y1={baseline} y2={baseline} stroke="#1a1a1a" strokeWidth={1} />
            <path d={area} fill={b.color} fillOpacity={0.16} />
            <path d={line} fill="none" stroke={b.color} strokeWidth={1.3} strokeLinejoin="round" />

            {/* inline lane label */}
            <text
              x={PAD_L - 14}
              y={top + LANE_H / 2 - 2}
              textAnchor="end"
              fill={b.color}
              fontSize={10.5}
              fontFamily="monospace"
            >
              {b.name}
            </text>
            <text
              x={PAD_L - 14}
              y={top + LANE_H / 2 + 10}
              textAnchor="end"
              fill="#5a5a5a"
              fontSize={8.5}
              fontFamily="monospace"
            >
              {b.range} Hz
            </text>
          </g>
        );
      })}

      {/* time axis */}
      {ticks.map((t) => (
        <text
          key={`t-${t}`}
          x={xOf(t)}
          y={H - 6}
          fill="#666"
          fontSize={10}
          fontFamily="monospace"
          textAnchor="middle"
        >
          {formatTime(t)}
        </text>
      ))}
      </svg>
    </div>
  );
}

function smooth(vals: number[], k: number): number[] {
  if (k <= 1) return vals;
  const half = Math.floor(k / 2);
  const out = new Array<number>(vals.length);
  for (let i = 0; i < vals.length; i++) {
    let sum = 0;
    let count = 0;
    for (let j = i - half; j <= i + half; j++) {
      if (j >= 0 && j < vals.length) {
        sum += vals[j];
        count++;
      }
    }
    out[i] = sum / count;
  }
  return out;
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

function formatTime(s: number): string {
  const m = Math.floor(s / 60);
  const r = Math.floor(s % 60);
  return `${m}:${r.toString().padStart(2, "0")}`;
}
