"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { BreakdownInput } from "@/lib/breakdown/prompt";
import { isDemoMode, REPO_URL } from "@/lib/demo";
import SectionHeading from "./SectionHeading";

type Status = "streaming" | "done" | "error";

const MONO = "var(--font-geist-mono), monospace";
const SANS = "var(--font-geist-sans), system-ui, sans-serif";

// Accent per section name, matched against the first word of a header line.
// Mirrors the waveform lane + spectral legend so colour reads consistently.
const SECTION_ACCENT: Record<string, string> = {
  overall: "#cfcfcf",
  intro: "#9a9a9a",
  verse: "#22c55e",
  buildup: "#f59e0b",
  drop: "#ef4444",
  breakdown: "#3b82f6",
  bridge: "#a78bfa",
  chorus: "#22c55e",
  outro: "#9a9a9a",
};

const HEADER_WORD =
  /^(overall|intro|verse|buildup|drop|breakdown|bridge|chorus|outro)\b/i;

type NoteSection = {
  key: string;
  title: string;
  accent: string;
  body: string[];
  takeaway?: string;
};

// The local model emits plain prose, not markdown structure: short header lines
// ("Overall", "intro (0:00–0:09)"), body paragraphs, and "Takeaway:" lines.
// We group those into per-section cards at render time, leaving the prompt
// (the IP) untouched.
function parseNotes(text: string): NoteSection[] {
  const sections: NoteSection[] = [];
  let current: NoteSection | null = null;

  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (!line) continue;

    if (/^takeaway\s*[:\-]/i.test(line)) {
      const body = line.replace(/^takeaway\s*[:\-]\s*/i, "");
      if (current) current.takeaway = body;
      continue;
    }

    const m = line.match(HEADER_WORD);
    if (m && line.length <= 48) {
      const key = m[1].toLowerCase();
      current = {
        key,
        title: line,
        accent: SECTION_ACCENT[key] ?? "#cccccc",
        body: [],
      };
      sections.push(current);
      continue;
    }

    if (!current) {
      current = {
        key: "overall",
        title: "Overall",
        accent: SECTION_ACCENT.overall,
        body: [],
      };
      sections.push(current);
    }
    current.body.push(line);
  }

  return sections;
}

function NoteCard({ section, featured }: { section: NoteSection; featured?: boolean }) {
  return (
    <div
      style={{
        border: "1px solid #1c1c1c",
        borderTop: `2px solid ${section.accent}`,
        background: "#0c0c0c",
        padding: featured ? "1.15rem 1.35rem 1.3rem" : "1rem 1.15rem 1.15rem",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          marginBottom: "0.75rem",
          fontFamily: MONO,
          fontSize: 12,
          letterSpacing: "0.09em",
          textTransform: "uppercase",
          color: section.accent,
        }}
      >
        <span style={{ width: 7, height: 7, background: section.accent, flexShrink: 0 }} />
        {section.title}
      </div>

      {section.body.map((p, i) => (
        <p
          key={i}
          style={{
            margin: "0 0 0.7rem",
            color: "#c9c9c9",
            lineHeight: 1.62,
            fontSize: featured ? 14.5 : 13.5,
          }}
        >
          {p}
        </p>
      ))}

      {section.takeaway && (
        <p
          style={{
            margin: "0.95rem 0 0",
            paddingLeft: "0.85rem",
            borderLeft: "2px solid #2c2c2c",
            color: "#9b9b9b",
            fontSize: 13,
            lineHeight: 1.5,
          }}
        >
          <span
            style={{
              fontFamily: MONO,
              color: "#6a6a6a",
              fontSize: 10,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              marginRight: 8,
            }}
          >
            takeaway
          </span>
          {section.takeaway}
        </p>
      )}
    </div>
  );
}

function DemoNotice() {
  return (
    <section>
      <SectionHeading title="production notes" />
      <p style={{ color: "#888", fontSize: 13.5, fontFamily: MONO, lineHeight: 1.62 }}>
        the production notes are written by a local Ollama model and are off in
        this hosted demo — everything above ran in your browser.{" "}
        <a
          href={REPO_URL}
          target="_blank"
          rel="noreferrer"
          style={{ color: "#c9c9c9", textDecoration: "underline" }}
        >
          clone the repo
        </a>{" "}
        and run it locally for the full write-up.
      </p>
    </section>
  );
}

export default function Breakdown({ input }: { input: BreakdownInput }) {
  // Constant for the lifetime of the bundle, so the conditional mount below
  // never flips between renders.
  if (isDemoMode()) return <DemoNotice />;
  return <LiveBreakdown input={input} />;
}

function LiveBreakdown({ input }: { input: BreakdownInput }) {
  const [text, setText] = useState("");
  const [status, setStatus] = useState<Status>("streaming");
  // Tracks the in-flight request so a new run (regenerate / new analysis /
  // unmount) can abort the previous stream. Without this the old stream keeps
  // writing its stale accumulator over the new one. Aborting the fetch also
  // trips the route's cancel() handler, stopping token generation server-side.
  const inFlight = useRef<AbortController | null>(null);

  const run = useCallback(async () => {
    inFlight.current?.abort();
    const ac = new AbortController();
    inFlight.current = ac;
    setText("");
    setStatus("streaming");
    try {
      const res = await fetch("/api/breakdown", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
        signal: ac.signal,
      });
      if (!res.ok || !res.body) {
        const msg =
          res.status === 503
            ? "local model unavailable — is Ollama running?"
            : "breakdown request failed";
        setText(msg);
        setStatus("error");
        return;
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let acc = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        acc += decoder.decode(value, { stream: true });
        setText(acc);
      }
      const trailing = decoder.decode(); // flush any split multibyte char
      if (trailing) setText((acc += trailing));
      setStatus("done");
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      setStatus("error");
      setText((t) => t || "stream interrupted");
    }
  }, [input]);

  useEffect(() => {
    run();
    return () => inFlight.current?.abort();
  }, [run]);

  const isError = status === "error";
  const sections = isError ? [] : parseNotes(text);
  const overall = sections[0]?.key === "overall" ? sections[0] : undefined;
  const cards = overall ? sections.slice(1) : sections;

  return (
    <section>
      <SectionHeading
        title="production notes"
        right={
          <>
            {status === "streaming" && text && (
              <span style={{ color: "#666", fontSize: 11, fontFamily: MONO }}>generating…</span>
            )}
            {(status === "done" || isError) && (
              <button
                onClick={run}
                style={{
                  fontFamily: MONO,
                  fontSize: 11,
                  background: "transparent",
                  color: "#888",
                  border: "1px solid #2a2a2a",
                  padding: "0.3rem 0.65rem",
                  cursor: "pointer",
                }}
              >
                {isError ? "retry" : "regenerate"}
              </button>
            )}
          </>
        }
      />

      <div style={{ fontFamily: SANS }}>
        {isError ? (
          <p style={{ color: "#c97676", fontSize: 13.5, fontFamily: MONO }}>{text}</p>
        ) : !text ? (
          <p style={{ color: "#666", fontSize: 13, fontFamily: MONO }}>
            reading the structure…
          </p>
        ) : (
          <div className="flex flex-col gap-4">
            {overall && <NoteCard section={overall} featured />}
            {cards.length > 0 && (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                {cards.map((s, i) => (
                  <NoteCard key={i} section={s} />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
