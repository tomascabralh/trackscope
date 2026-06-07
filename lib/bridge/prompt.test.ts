import { describe, it, expect } from "vitest";
import { buildAbletonMessages } from "./prompt";
import type { AbletonBridgeInput } from "./facts";
import { fixtures } from "../breakdown/__fixtures__";

describe("buildAbletonMessages", () => {
  const input = fixtures[0].input as AbletonBridgeInput;
  const { system, user } = buildAbletonMessages(input);

  it("instructs the model to write a prompt for an ableton-mcp Claude", () => {
    expect(system.toLowerCase()).toContain("ableton-mcp");
    expect(system.toLowerCase()).toContain("stock");
  });

  it("forbids invented lore and third-party plugins in the system prompt", () => {
    expect(system.toLowerCase()).toMatch(/do not invent|never invent/);
    expect(system.toLowerCase()).toContain("third-party");
  });

  it("puts the fixed facts in the user message", () => {
    expect(user).toContain(`Tempo: ${input.bpm} BPM`);
    expect(user).toMatch(/bars \d+–\d+/);
  });

  it("leaks no raw dB/LUFS numbers into the user message", () => {
    expect(user).not.toMatch(/-?\d+(\.\d+)?\s?(dbfs|db|lufs)/i);
  });
});
