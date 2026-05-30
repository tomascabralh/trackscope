"use client";

import { useRef } from "react";

interface UploaderProps {
  onFile: (file: File) => void;
}

export default function Uploader({ onFile }: UploaderProps) {
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
  );
}
