import { describe, expect, it } from "vitest";

import { scoreBreakdown } from "./score";
import type { BreakdownInput } from "./prompt";
import type { SectionWithSpectra } from "./section-spectra";

function section(
  label: SectionWithSpectra["label"],
  startS: number,
  endS: number
): SectionWithSpectra {
  return {
    label,
    startS,
    endS,
    bandsDb: { sub: -6, low: -6, mid: -6, highMid: -6, high: -6 },
  };
}

const input: BreakdownInput = {
  bpm: 124,
  key: "A minor",
  lufs: -8,
  durationS: 90,
  sections: [section("intro", 0, 30), section("drop", 30, 90)],
};

/** A breakdown that obeys every hard rule, used as the clean baseline. */
const clean = [
  "## Overall",
  "124 BPM, minor-key, mastered hot with little headroom. Sub-led with scooped mids; the top opens up late.",
  "",
  "## intro (0:00–0:30)",
  "Sparse and bright relative to the rest — the high band sits forward while the sub stays back. Leave room up top and hold the low end out.",
  "",
  "## drop (0:30–1:30)",
  "The sub drops in and dominates, mids recede. Carve the low-mids to keep it from clouding.",
].join("\n");

describe("scoreBreakdown", () => {
  it("passes a clean, well-formed breakdown", () => {
    const result = scoreBreakdown(clean, input);
    expect(result.violations).toEqual([]);
    expect(result.passed).toBe(true);
  });

  it("flags invented dB and LUFS numbers but allows the BPM figure", () => {
    const text = clean.replace(
      "the sub stays back",
      "the sub sits around -18 dB and the track reads -8 LUFS"
    );
    const result = scoreBreakdown(text, input);
    const rules = result.violations.map((v) => v.rule);
    expect(rules).toContain("no-invented-levels");
    // two offending figures, the BPM "124" must not be flagged
    expect(result.violations.filter((v) => v.rule === "no-invented-levels")).toHaveLength(2);
  });

  it("flags named instruments and sounds", () => {
    const text = clean.replace(
      "the high band sits forward",
      "a supersaw lead and a vocal chop sit forward"
    );
    const result = scoreBreakdown(text, input);
    const rules = result.violations.map((v) => v.rule);
    expect(rules).toContain("no-named-instruments");
  });

  it("accepts headings the model has bolded with markdown emphasis", () => {
    const text = clean
      .replace("## intro (0:00–0:30)", "## **intro (0:00–0:30)**")
      .replace("## drop (0:30–1:30)", "## **drop (0:30–1:30)**");
    const result = scoreBreakdown(text, input);
    expect(result.violations.map((v) => v.rule)).not.toContain("structure");
  });

  it("flags a missing ## Overall heading", () => {
    const text = clean.replace("## Overall", "## Summary");
    const result = scoreBreakdown(text, input);
    expect(result.violations.map((v) => v.rule)).toContain("structure");
  });

  it("flags a missing or out-of-order section heading", () => {
    const text = clean.replace("## drop (0:30–1:30)", "## bridge (0:30–1:30)");
    const result = scoreBreakdown(text, input);
    expect(result.violations.map((v) => v.rule)).toContain("structure");
  });
});
