"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import type { BreakdownInput } from "@/lib/breakdown/prompt";

type Status = "streaming" | "done" | "error";

export default function Breakdown({ input }: { input: BreakdownInput }) {
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
      const res = await fetch("/api/refboi/breakdown", {
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

  return (
    <section style={{ marginTop: "2rem" }}>
      <h2 style={{ fontSize: 16 }}>production notes</h2>
      <div style={{ fontFamily: "system-ui, sans-serif", lineHeight: 1.5 }}>
        <ReactMarkdown>{text}</ReactMarkdown>
      </div>
      {status === "streaming" && <p style={{ color: "#888", fontSize: 12 }}>generating…</p>}
      {(status === "done" || status === "error") && (
        <button
          onClick={run}
          style={{
            marginTop: "0.5rem",
            fontFamily: "monospace",
            fontSize: 12,
            background: "transparent",
            color: "#888",
            border: "1px solid #2a2a2a",
            padding: "0.3rem 0.6rem",
            cursor: "pointer",
          }}
        >
          {status === "error" ? "retry" : "regenerate"}
        </button>
      )}
    </section>
  );
}
