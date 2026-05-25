import { describe, it, expect } from "vitest";
import { parseNdjson } from "./client";

function streamOf(chunks: string[]): ReadableStream<Uint8Array> {
  const enc = new TextEncoder();
  let i = 0;
  return new ReadableStream({
    pull(controller) {
      if (i < chunks.length) controller.enqueue(enc.encode(chunks[i++]));
      else controller.close();
    },
  });
}

async function collect(gen: AsyncIterable<string>): Promise<string> {
  let out = "";
  for await (const d of gen) out += d;
  return out;
}

describe("parseNdjson", () => {
  it("yields message.content deltas across newline-delimited JSON", async () => {
    const s = streamOf([
      '{"message":{"content":"Hello "},"done":false}\n',
      '{"message":{"content":"world"},"done":false}\n',
      '{"message":{"content":""},"done":true}\n',
    ]);
    expect(await collect(parseNdjson(s))).toBe("Hello world");
  });

  it("reassembles a JSON object split across two chunks", async () => {
    const s = streamOf([
      '{"message":{"con',
      'tent":"split"},"done":false}\n{"message":{"content":"!"},"done":true}\n',
    ]);
    expect(await collect(parseNdjson(s))).toBe("split!");
  });

  it("ignores empty and malformed lines", async () => {
    const s = streamOf([
      "\n",
      "not json\n",
      '{"message":{"content":"ok"},"done":true}\n',
    ]);
    expect(await collect(parseNdjson(s))).toBe("ok");
  });
});
