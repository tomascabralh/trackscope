import type { TrackMetadata } from "@/lib/audio/types";

interface TrackInfoProps {
  metadata: TrackMetadata;
  durationS: number;
  originalSampleRate: number;
  originalChannels: number;
}

export default function TrackInfo({
  metadata,
  durationS,
  originalSampleRate,
  originalChannels,
}: TrackInfoProps) {
  const title = metadata.title ?? stripExtension(metadata.fileName);
  const facts: [string, string][] = [];
  if (metadata.year) facts.push(["year", String(metadata.year)]);
  if (metadata.genre) facts.push(["genre", metadata.genre]);
  if (metadata.trackNumber) facts.push(["track", String(metadata.trackNumber)]);
  facts.push(["duration", formatDuration(durationS)]);
  if (metadata.bitrateKbps) facts.push(["bitrate", `${metadata.bitrateKbps} kbps`]);
  facts.push(["sample rate", `${(originalSampleRate / 1000).toFixed(1)} kHz`]);
  facts.push(["channels", originalChannels === 1 ? "mono" : originalChannels === 2 ? "stereo" : `${originalChannels}ch`]);
  if (metadata.codec) facts.push(["codec", metadata.codec]);
  if (metadata.container) facts.push(["container", metadata.container]);
  facts.push(["file size", formatBytes(metadata.fileSizeBytes)]);
  facts.push(["filename", metadata.fileName]);

  return (
    <div
      style={{
        display: "flex",
        gap: "1rem",
        alignItems: "center",
      }}
    >
      <div
        style={{
          width: 88,
          height: 88,
          flexShrink: 0,
          background: "#1a1a1a",
          border: "1px solid #2a2a2a",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#555",
          fontSize: 10,
          overflow: "hidden",
        }}
      >
        {metadata.coverDataUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={metadata.coverDataUrl}
            alt=""
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        ) : (
          "no cover"
        )}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 16,
            fontWeight: 600,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {title}
        </div>
        <div style={{ color: "#999", fontSize: 12.5, marginTop: 1 }}>
          {[metadata.artist, metadata.album].filter(Boolean).join(" · ")}
        </div>

        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            columnGap: "0.9rem",
            rowGap: "0.2rem",
            marginTop: "0.7rem",
            fontSize: 11.5,
            color: "#bbb",
          }}
        >
          {facts.map(([k, v]) => (
            <span key={k} style={{ whiteSpace: "nowrap" }}>
              <span style={{ color: "#5a5a5a" }}>{k} </span>
              {v}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function stripExtension(name: string): string {
  const i = name.lastIndexOf(".");
  return i > 0 ? name.slice(0, i) : name;
}

function formatDuration(s: number): string {
  const m = Math.floor(s / 60);
  const r = Math.floor(s % 60);
  return `${m}:${r.toString().padStart(2, "0")}`;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
