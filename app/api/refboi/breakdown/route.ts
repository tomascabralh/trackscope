import { getAnthropic } from "@/lib/claude/client";
import {
  buildBreakdownMessages,
  type BreakdownInput,
} from "@/lib/refboi/breakdown-prompt";
import type Anthropic from "@anthropic-ai/sdk";

export const runtime = "nodejs";

function isValid(body: unknown): body is BreakdownInput {
  if (!body || typeof body !== "object") return false;
  const b = body as Record<string, unknown>;
  return (
    typeof b.bpm === "number" &&
    typeof b.key === "string" &&
    typeof b.lufs === "number" &&
    typeof b.durationS === "number" &&
    Array.isArray(b.sections)
  );
}

export async function POST(req: Request) {
  const anthropic = getAnthropic();
  if (!anthropic) {
    return Response.json({ error: "breakdowns disabled" }, { status: 503 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "invalid JSON" }, { status: 400 });
  }
  if (!isValid(body)) {
    return Response.json({ error: "invalid breakdown input" }, { status: 400 });
  }

  const { system, messages } = buildBreakdownMessages(body);

  try {
    // Our SystemBlock[] is structurally compatible with TextBlockParam[] —
    // cache_control: { type: "ephemeral" } satisfies CacheControlEphemeral.
    // Our UserMessage[] is structurally compatible with MessageParam[].
    const stream = anthropic.messages.stream({
      model: "claude-sonnet-4-6",
      max_tokens: 1500,
      system: system as Anthropic.TextBlockParam[],
      messages: messages as Anthropic.MessageParam[],
    });

    const encoder = new TextEncoder();
    const readable = new ReadableStream<Uint8Array>({
      async start(controller) {
        try {
          for await (const event of stream) {
            if (
              event.type === "content_block_delta" &&
              event.delta.type === "text_delta"
            ) {
              controller.enqueue(encoder.encode(event.delta.text));
            }
          }
          controller.close();
        } catch {
          controller.error(new Error("stream failed"));
        }
      },
    });

    return new Response(readable, {
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  } catch {
    return Response.json({ error: "breakdown failed" }, { status: 500 });
  }
}
