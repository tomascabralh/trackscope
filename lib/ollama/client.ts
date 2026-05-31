const DEFAULT_HOST = "http://127.0.0.1:11434";
const DEFAULT_MODEL = "llama3.2:3b";

/** Thrown when the local Ollama server can't be reached or rejects the request. */
export class OllamaUnavailableError extends Error {}

interface StreamChatOpts {
  system: string;
  user: string;
  model?: string;
  signal?: AbortSignal;
}

/**
 * Opens a streaming chat against the local Ollama server. Awaiting this performs
 * the request and validates the response, so connection/setup failures surface
 * here (before the caller commits a streaming HTTP response). The returned
 * iterable yields assistant text deltas.
 */
export async function streamChat(opts: StreamChatOpts): Promise<AsyncIterable<string>> {
  const host = process.env.OLLAMA_HOST ?? DEFAULT_HOST;
  const model = opts.model ?? process.env.OLLAMA_MODEL ?? DEFAULT_MODEL;

  let res: Response;
  try {
    res = await fetch(`${host}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: opts.system },
          { role: "user", content: opts.user },
        ],
        stream: true,
        options: { temperature: 0.7, num_predict: 1500 },
      }),
      signal: opts.signal,
    });
  } catch (err) {
    throw new OllamaUnavailableError(err instanceof Error ? err.message : "fetch failed");
  }

  if (!res.ok || !res.body) {
    const detail = await res.text().catch(() => "");
    throw new OllamaUnavailableError(`ollama responded ${res.status}: ${detail}`);
  }

  return parseNdjson(res.body);
}

/** Parses Ollama's newline-delimited JSON stream, yielding message.content deltas. */
export async function* parseNdjson(
  body: ReadableStream<Uint8Array>
): AsyncGenerator<string> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let nl: number;
      while ((nl = buffer.indexOf("\n")) !== -1) {
        const line = buffer.slice(0, nl).trim();
        buffer = buffer.slice(nl + 1);
        const delta = extractDelta(line);
        if (delta) yield delta;
      }
    }
    const delta = extractDelta(buffer.trim());
    if (delta) yield delta;
  } finally {
    reader.releaseLock();
  }
}

function extractDelta(line: string): string | null {
  if (!line) return null;
  try {
    const obj = JSON.parse(line) as { message?: { content?: string } };
    return obj.message?.content ?? null;
  } catch {
    return null; // ignore keepalive / malformed lines
  }
}
