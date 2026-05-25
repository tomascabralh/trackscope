import {
  buildBreakdownMessages,
  type BreakdownInput,
} from "@/lib/refboi/breakdown-prompt";
import { streamChat, OllamaUnavailableError } from "@/lib/ollama/client";

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
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "invalid JSON" }, { status: 400 });
  }
  if (!isValid(body)) {
    return Response.json({ error: "invalid breakdown input" }, { status: 400 });
  }

  const { system, user } = buildBreakdownMessages(body);
  const ac = new AbortController();

  // Performed eagerly: a down/misconfigured Ollama fails here, before we commit
  // the streaming response, so we can still return a clean 503.
  let deltas: AsyncIterable<string>;
  try {
    deltas = await streamChat({ system, user, signal: ac.signal });
  } catch (err) {
    if (err instanceof OllamaUnavailableError) {
      return Response.json({ error: "local model unavailable" }, { status: 503 });
    }
    return Response.json({ error: "breakdown failed" }, { status: 500 });
  }

  const encoder = new TextEncoder();
  const readable = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const delta of deltas) {
          controller.enqueue(encoder.encode(delta));
        }
        controller.close();
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        controller.error(err instanceof Error ? err : new Error("stream failed"));
      }
    },
    // Client disconnected (navigate away / regenerate). Abort the upstream
    // Ollama request so it stops generating.
    cancel() {
      ac.abort();
    },
  });

  return new Response(readable, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
