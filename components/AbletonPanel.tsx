"use client";

import { useState } from "react";
import SectionHeading from "./SectionHeading";
import { buildAbletonPrompt } from "@/lib/bridge/build-prompt";
import type { BreakdownInput } from "@/lib/breakdown/prompt";

const MONO = "var(--font-geist-mono), monospace";
const SANS = "var(--font-geist-sans), system-ui, sans-serif";

export default function AbletonPanel({ input }: { input: BreakdownInput }) {
  const prompt = buildAbletonPrompt(input);
  const [copied, setCopied] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(prompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <section>
      <SectionHeading title="ableton-mcp-extended" />
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
          ableton-mcp
        </a>{" "}
        connected and Ableton Live open. Claude scaffolds the tempo, tracks, and
        section structure below.
      </p>

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
          {prompt}
        </pre>
      </div>
    </section>
  );
}
