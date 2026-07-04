import { describe, expect, it } from "vitest";

import { buildJudgeMessages, parseJudgeResponse } from "./judge";
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

describe("buildJudgeMessages", () => {
  it("asks for JSON and embeds the track facts and the breakdown under review", () => {
    const breakdown = "## Overall\nsub-led, scooped mids.";
    const { system, user } = buildJudgeMessages(input, breakdown);
    expect(system.toLowerCase()).toContain("json");
    expect(system.toLowerCase()).toContain("overall");
    expect(user).toContain(breakdown);
    expect(user).toContain("124");
    expect(user).toContain("A minor");
  });
});

describe("parseJudgeResponse", () => {
  it("parses a clean JSON object into a score", () => {
    const raw = JSON.stringify({
      specificity: 4,
      usefulness: 3,
      voice: 5,
      overall: 7,
      soft_violations: ["named a 'lead sound' in intro"],
      notes: "solid but a bit generic",
    });
    const result = parseJudgeResponse(raw);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.score.specificity).toBe(4);
    expect(result.score.overall).toBe(7);
    expect(result.score.softViolations).toEqual(["named a 'lead sound' in intro"]);
    expect(result.score.notes).toBe("solid but a bit generic");
  });

  it("recovers JSON wrapped in code fences and surrounding prose", () => {
    const raw = [
      "Here is my assessment:",
      "```json",
      '{ "specificity": 2, "usefulness": 2, "voice": 3, "overall": 4, "soft_violations": [], "notes": "thin" }',
      "```",
      "Hope that helps!",
    ].join("\n");
    const result = parseJudgeResponse(raw);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.score.overall).toBe(4);
    expect(result.score.softViolations).toEqual([]);
  });

  it("tolerates the pretty-printed JSON with trailing commas that 8b models emit", () => {
    const raw = [
      "{",
      '  "specificity": 4,',
      '  "usefulness": 3,',
      '  "voice": 2,',
      '  "overall": 6,',
      '  "soft_violations": [',
      '    "named a kick in the drop",',
      "  ],",
      '  "notes": "decent but soft on voice",',
      "}",
    ].join("\n");
    const result = parseJudgeResponse(raw);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.score.overall).toBe(6);
    expect(result.score.voice).toBe(2);
    expect(result.score.softViolations).toEqual(["named a kick in the drop"]);
  });

  it("clamps out-of-range scores to their valid bounds", () => {
    const raw = JSON.stringify({
      specificity: 9,
      usefulness: 0,
      voice: 3,
      overall: 50,
      soft_violations: [],
      notes: "x",
    });
    const result = parseJudgeResponse(raw);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.score.specificity).toBe(5);
    expect(result.score.usefulness).toBe(1);
    expect(result.score.overall).toBe(10);
  });

  it("fails gracefully on unparseable output", () => {
    const result = parseJudgeResponse("the track is pretty good i guess");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.raw).toContain("pretty good");
  });
});
