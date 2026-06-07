"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import SectionHeading from "./SectionHeading";
import { buildOfflinePrompt, type AbletonBridgeInput } from "@/lib/bridge/facts";

type Status = "streaming" | "done" | "error" | "offline";

const MONO = "var(--font-geist-mono), monospace";
const SANS = "var(--font-geist-sans), system-ui, sans-serif";

export default function AbletonPanel({ input }: { input: AbletonBridgeInput }) {
  const [text, setText] = useState("");
  const [status, setStatus] = useState<Status>("streaming");
  const [copied, setCopied] = useState(false);
  const inFlight = useRef<AbortController | null>(null);

  const run = useCallback(async () => {
    inFlight.current?.abort();
    const ac = new AbortController();
    inFlight.current = ac;
    setText("");
    setStatus("streaming");
    try {
      const res = await fetch("/api/ableton-build", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
        signal: ac.signal,
      });
      if (res.status === 503) {
        setText(buildOfflinePrompt(input));
        setStatus("offline");
        return;
      }
      if (!res.ok || !res.body) {
        setText("build-prompt request failed");
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
      const trailing = decoder.decode();
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

  async function copy() {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  const isError = status === "error";

  return (
    <section>
      <SectionHeading
        title="ableton-mcp-extended"
        right={
          status === "streaming" && text ? (
            <span style={{ color: "#666", fontSize: 11, fontFamily: MONO }}>generating…</span>
          ) : status === "done" || status === "offline" || isError ? (
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
          ) : null
        }
      />

      <p
        style={{
          fontFamily: SANS,
          fontSize: 13.5,
          lineHeight: 1.65,
          color: "#888",
          margin: "0 0 1rem",
        }}
      >
        Paste this into a Claude session with{" "}
        <a
          href="https://github.com/tomascabralh/ableton-mcp-extended"
          target="_blank"
          rel="noreferrer"
          style={{ color: "#aaa", textDecoration: "underline" }}
        >
          ableton-mcp-extended
        </a>{" "}
        connected and Ableton Live open.
        {status === "offline" && " (Ollama offline — showing the basic scaffold.)"}
      </p>

      {isError ? (
        <p style={{ color: "#c97676", fontSize: 13.5, fontFamily: MONO }}>{text}</p>
      ) : !text ? (
        <p style={{ color: "#666", fontSize: 13, fontFamily: MONO }}>reading the structure…</p>
      ) : (
        <div style={{ position: "relative" }}>
          <button
            onClick={copy}
            style={{
              position: "absolute",
              top: 10,
              right: 10,
              fontFamily: MONO,
              fontSize: 11,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: copied ? "#7fae7f" : "#aaa",
              background: "#161616",
              border: "1px solid #2a2a2a",
              padding: "0.35rem 0.6rem",
              cursor: "pointer",
            }}
          >
            {copied ? "copied" : "copy"}
          </button>
          <pre
            style={{
              fontFamily: MONO,
              fontSize: 12.5,
              lineHeight: 1.7,
              color: "#cfcfcf",
              background: "#0c0c0c",
              border: "1px solid #1c1c1c",
              padding: "1.25rem 1.5rem",
              margin: 0,
              whiteSpace: "pre-wrap",
              overflowX: "auto",
            }}
          >
            {text}
          </pre>
        </div>
      )}
    </section>
  );
}
