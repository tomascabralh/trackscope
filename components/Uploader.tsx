"use client";

import { useRef } from "react";

interface UploaderProps {
  onFile: (file: File) => void;
  compact?: boolean;
}

export default function Uploader({ onFile, compact = false }: UploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) onFile(file);
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) onFile(file);
  }

  return (
    <div
      onDrop={onDrop}
      onDragOver={(e) => e.preventDefault()}
      onClick={() => inputRef.current?.click()}
      style={{
        border: `1px dashed ${compact ? "#333" : "#666"}`,
        padding: compact ? "0.85rem 1.25rem" : "3rem 2rem",
        cursor: "pointer",
        textAlign: "center",
        color: compact ? "#666" : "#999",
        fontSize: compact ? 12 : 14,
        letterSpacing: compact ? "0.04em" : "normal",
        transition: "border-color 120ms, color 120ms",
      }}
    >
      {compact
        ? "drop another track, or click to browse"
        : "drop mp3 / wav here, or click to browse"}
      <input
        ref={inputRef}
        type="file"
        accept=".mp3,.wav,audio/mpeg,audio/wav"
        style={{ display: "none" }}
        onChange={onFileChange}
      />
    </div>
  );
}
