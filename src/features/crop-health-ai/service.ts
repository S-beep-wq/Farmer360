import "server-only";

import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";

import type { PhotoType } from "@/features/observations/photo";

import { contextText, SYSTEM_PROMPT, type AnalysisContext } from "./prompt";
import { normalizeResult } from "./rules";
import { cropHealthResultSchema, type CropHealthResult } from "./schema";

// The AI service (SYSTEM_ARCHITECTURE.md section 10): isolated from the database, returns a
// structured, validated result, or a reason it could not. Runs on the server only; the API key
// never reaches the browser.

export const CROP_HEALTH_MODEL = "claude-opus-5-5";

/** AI help is offered only when the server has an API key (USER_WORKFLOWS.md 8: "if enabled"). */
export function isCropHealthAiEnabled(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

export type AnalysisOutcome =
  | { ok: true; result: CropHealthResult; model: string }
  | { ok: false; reason: "refused" | "unavailable" | "invalid" };

export type AnalysisPhoto = { data: Uint8Array; type: PhotoType };

export async function analyzeCropPhotos(photos: AnalysisPhoto[], context: AnalysisContext): Promise<AnalysisOutcome> {
  const client = new Anthropic({ timeout: 90_000, maxRetries: 1 });
  try {
    const response = await client.beta.messages.parse({
      model: CROP_HEALTH_MODEL,
      max_tokens: 8000,
      // If the model declines, Anthropic's recommended fallback model answers instead.
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      thinking: { type: "adaptive" },
      output_config: { effort: "medium", format: betaZodOutputFormat(cropHealthResultSchema) },
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: [
            ...photos.map((p) => ({
              type: "image" as const,
              source: { type: "base64" as const, media_type: p.type.mime, data: Buffer.from(p.data).toString("base64") },
            })),
            { type: "text" as const, text: contextText(context) },
          ],
        },
      ],
    });
    if (response.stop_reason === "refusal") return { ok: false, reason: "refused" };
    if (response.stop_reason === "max_tokens" || !response.parsed_output) return { ok: false, reason: "invalid" };
    return { ok: true, result: normalizeResult(response.parsed_output, context.farmerStatus), model: response.model };
  } catch (error) {
    // Network problems, rate limits and server errors (all APIError): try again later.
    if (error instanceof Anthropic.APIError) {
      console.error("crop health AI request failed", { status: error.status, type: error.name });
      return { ok: false, reason: "unavailable" };
    }
    // Anything else is an answer that did not match the expected structure.
    console.error("crop health AI answer was not usable", { message: error instanceof Error ? error.message : String(error) });
    return { ok: false, reason: "invalid" };
  }
}
