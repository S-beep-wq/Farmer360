import "server-only";

import Anthropic from "@anthropic-ai/sdk";

// Shared set-up for the AI features (SYSTEM_ARCHITECTURE.md section 10). Server only: the API key
// never reaches the browser.

export const AI_MODEL = "claude-opus-5-5";

/** AI features are offered only when the server has an API key. */
export function isAiEnabled(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

export function aiClient(): Anthropic {
  return new Anthropic({ timeout: 90_000, maxRetries: 1 });
}

/** Ask Anthropic's recommended fallback model to answer if the main model declines. */
export function aiFallback(): { betas: Anthropic.Beta.AnthropicBeta[]; fallbacks: "default" } {
  return { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" };
}

export type AiFailure = "refused" | "unavailable" | "invalid";

/** Network, rate-limit and server errors are "unavailable"; an unusable answer is "invalid". */
export function aiFailureFrom(error: unknown, what: string): AiFailure {
  if (error instanceof Anthropic.APIError) {
    console.error(`${what}: AI request failed`, { status: error.status, type: error.name });
    return "unavailable";
  }
  console.error(`${what}: AI answer was not usable`, { message: error instanceof Error ? error.message : String(error) });
  return "invalid";
}
