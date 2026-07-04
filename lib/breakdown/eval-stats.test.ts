import { describe, expect, it } from "vitest";

import { summarizeRuns, type RunMetrics } from "./eval-stats";
import type { JudgeResult } from "./judge";

function judged(
  specificity: number,
  usefulness: number,
  voice: number,
  overall: number,
  softViolations: string[] = []
): JudgeResult {
  return { ok: true, score: { specificity, usefulness, voice, overall, softViolations, notes: "" } };
}

const unparsed: JudgeResult = { ok: false, raw: "garbage" };

describe("summarizeRuns", () => {
  it("averages judge overall and axes across parsed runs", () => {
    const runs: RunMetrics[] = [
      { hardViolations: 0, judge: judged(4, 3, 2, 6) },
      { hardViolations: 0, judge: judged(2, 5, 4, 8) },
    ];
    const s = summarizeRuns(runs);
    expect(s.meanOverall).toBe(7);
    expect(s.meanAxes).toEqual({ specificity: 3, usefulness: 4, voice: 3 });
    expect(s.parsedJudges).toBe(2);
  });

  it("averages hard violations over every run, judge means over parsed runs only", () => {
    const runs: RunMetrics[] = [
      { hardViolations: 2, judge: judged(4, 4, 4, 6) },
      { hardViolations: 0, judge: unparsed },
    ];
    const s = summarizeRuns(runs);
    expect(s.meanHardViolations).toBe(1);
    expect(s.meanOverall).toBe(6); // only the one parsed run counts
    expect(s.parsedJudges).toBe(1);
  });

  it("averages the soft-violation count across parsed runs", () => {
    const runs: RunMetrics[] = [
      { hardViolations: 0, judge: judged(3, 3, 3, 5, ["a", "b"]) },
      { hardViolations: 0, judge: judged(3, 3, 3, 5, []) },
    ];
    const s = summarizeRuns(runs);
    expect(s.meanSoftViolations).toBe(1);
  });

  it("reports null judge means when nothing parsed", () => {
    const s = summarizeRuns([{ hardViolations: 1, judge: unparsed }]);
    expect(s.meanOverall).toBeNull();
    expect(s.meanAxes).toBeNull();
    expect(s.meanSoftViolations).toBeNull();
    expect(s.meanHardViolations).toBe(1);
  });
});
