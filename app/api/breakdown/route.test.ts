import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/ollama/client", () => {
  class OllamaUnavailableError extends Error {}
  return {
    OllamaUnavailableError,
    streamChat: vi.fn(async () => {
      return (async function* () {
        yield "notes";
      })();
    }),
  };
});

import { POST } from "./route";
import { streamChat } from "@/lib/ollama/client";

const validInput = {
  bpm: 128,
  key: "A minor",
  lufs: -8.2,
  durationS: 240,
  sections: [],
};

function post(body: unknown): Promise<Response> {
  return POST(
    new Request("http://localhost/api/breakdown", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

describe("POST /api/breakdown demo mode", () => {
  it("refuses with 503 and never touches Ollama when demo mode is on", async () => {
    vi.stubEnv("NEXT_PUBLIC_DEMO_MODE", "1");
    const res = await post(validInput);
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.error).toMatch(/demo/i);
    expect(streamChat).not.toHaveBeenCalled();
  });

  it("streams the breakdown as usual when demo mode is off", async () => {
    const res = await post(validInput);
    expect(res.status).toBe(200);
    expect(await res.text()).toBe("notes");
    expect(streamChat).toHaveBeenCalledOnce();
  });
});
