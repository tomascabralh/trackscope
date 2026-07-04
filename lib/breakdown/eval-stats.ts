import type { JudgeResult } from "./judge";

export interface RunMetrics {
  hardViolations: number;
  judge?: JudgeResult;
}

export interface RunSummary {
  runs: number;
  parsedJudges: number;
  meanHardViolations: number;
  /** Mean of the judge overall over parsed runs, or null if none parsed. */
  meanOverall: number | null;
  meanAxes: { specificity: number; usefulness: number; voice: number } | null;
  meanSoftViolations: number | null;
}

const round1 = (n: number) => Math.round(n * 10) / 10;
const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

/**
 * Average metrics across N runs of the same fixture so prompt edits can be
 * judged on a denoised signal instead of one noisy sample. Judge means count
 * only the runs whose judge output parsed; hard violations count every run.
 */
export function summarizeRuns(metrics: RunMetrics[]): RunSummary {
  const parsed = metrics
    .map((m) => m.judge)
    .filter((j): j is Extract<JudgeResult, { ok: true }> => j?.ok === true)
    .map((j) => j.score);

  const judgeMeans =
    parsed.length === 0
      ? { meanOverall: null, meanAxes: null, meanSoftViolations: null }
      : {
          meanOverall: round1(mean(parsed.map((s) => s.overall))),
          meanAxes: {
            specificity: round1(mean(parsed.map((s) => s.specificity))),
            usefulness: round1(mean(parsed.map((s) => s.usefulness))),
            voice: round1(mean(parsed.map((s) => s.voice))),
          },
          meanSoftViolations: round1(mean(parsed.map((s) => s.softViolations.length))),
        };

  return {
    runs: metrics.length,
    parsedJudges: parsed.length,
    meanHardViolations: round1(mean(metrics.map((m) => m.hardViolations))),
    ...judgeMeans,
  };
}
