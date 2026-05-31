interface ResultsPanelProps {
  bpm: number;
  musicalKey: string;
  lufs: number;
}

const TILES: { label: string; value: (p: ResultsPanelProps) => string; hint: string }[] = [
  { label: "tempo", value: (p) => `${p.bpm}`, hint: "bpm" },
  { label: "key", value: (p) => p.musicalKey, hint: "" },
  { label: "loudness", value: (p) => `${p.lufs}`, hint: "lufs" },
];

export default function ResultsPanel(props: ResultsPanelProps) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        gap: "0.7rem",
        minWidth: 200,
      }}
    >
      {TILES.map((t) => (
        <div
          key={t.label}
          style={{
            display: "flex",
            alignItems: "baseline",
            justifyContent: "space-between",
            gap: "1.75rem",
          }}
        >
          <span
            style={{
              fontSize: 10,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              color: "#666",
            }}
          >
            {t.label}
          </span>
          <span style={{ display: "flex", alignItems: "baseline", gap: 5 }}>
            <span style={{ fontSize: 19, lineHeight: 1, color: "#ededed" }}>
              {t.value(props)}
            </span>
            {t.hint && <span style={{ fontSize: 10.5, color: "#555" }}>{t.hint}</span>}
          </span>
        </div>
      ))}
    </div>
  );
}
