import type { BreakdownInput } from "../prompt";

import housePeaktime from "./house-peaktime.json";
import dnbRoller from "./dnb-roller.json";
import ambientDowntempo from "./ambient-downtempo.json";
import technoWarehouse from "./techno-warehouse.json";

export interface BreakdownFixture {
  /** kebab-case id, also the JSON filename stem — used to select a single fixture in the eval CLI. */
  id: string;
  input: BreakdownInput;
}

/**
 * Hand-authored reference inputs spanning distinct tempo/key/loudness/spectral
 * profiles. Deterministic inputs for prompt-builder tests and manual eval runs.
 * Drop genuine captured runs in here too (same shape) to grow coverage.
 */
export const fixtures: BreakdownFixture[] = [
  { id: "house-peaktime", input: housePeaktime as BreakdownInput },
  { id: "dnb-roller", input: dnbRoller as BreakdownInput },
  { id: "ambient-downtempo", input: ambientDowntempo as BreakdownInput },
  { id: "techno-warehouse", input: technoWarehouse as BreakdownInput },
];
