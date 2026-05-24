import Anthropic from "@anthropic-ai/sdk";

let client: Anthropic | null = null;

/** Returns a singleton Anthropic client, or null if no API key is configured. */
export function getAnthropic(): Anthropic | null {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;
  if (!client) client = new Anthropic({ apiKey });
  return client;
}
