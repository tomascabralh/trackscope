"use client";

const MONO = "var(--font-geist-mono), monospace";

export type TabId = "overview" | "spectral" | "notes" | "ableton";

const TABS: { id: TabId; label: string; wip?: boolean }[] = [
  { id: "overview", label: "overview" },
  { id: "spectral", label: "spectral bands" },
  { id: "notes", label: "production notes (AI)" },
  { id: "ableton", label: "ableton-mcp", wip: true },
];

interface TabsProps {
  active: TabId;
  onChange: (id: TabId) => void;
}

export function WipBadge() {
  return (
    <span
      style={{
        fontFamily: MONO,
        fontSize: 8.5,
        letterSpacing: "0.12em",
        textTransform: "uppercase",
        color: "#f59e0b",
        border: "1px solid rgba(245,158,11,0.35)",
        padding: "1px 4px",
        lineHeight: 1,
      }}
    >
      wip
    </span>
  );
}

export default function Tabs({ active, onChange }: TabsProps) {
  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: "0.15rem",
        borderBottom: "1px solid #1c1c1c",
      }}
    >
      {TABS.map((t) => {
        const isActive = t.id === active;
        return (
          <button
            key={t.id}
            onClick={() => onChange(t.id)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 7,
              fontFamily: MONO,
              fontSize: 12.5,
              letterSpacing: "0.03em",
              padding: "0.6rem 0.95rem",
              marginBottom: -1,
              background: "transparent",
              border: "none",
              borderBottom: `2px solid ${isActive ? "#ededed" : "transparent"}`,
              color: isActive ? "#ededed" : "#6f6f6f",
              cursor: "pointer",
              transition: "color 120ms",
            }}
          >
            {t.label}
            {t.wip && <WipBadge />}
          </button>
        );
      })}
    </div>
  );
}
