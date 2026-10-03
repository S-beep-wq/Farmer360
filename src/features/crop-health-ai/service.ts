import "server-only";

import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";

import type { PhotoType } from "@/features/observations/photo";
import { AI_MODEL, aiFallback, aiClient, aiFailureFrom, isAiEnabled, type AiFailure } from "@/lib/ai";

import { contextText, SYSTEM_PROMPT, type AnalysisContext } from "./prompt";
import { normalizeResult } from "./rules";
import { cropHealthResultSchema, type CropHealthResult } from "./schema";

// The AI service (SYSTEM_ARCHITECTURE.md section 10): isolated from the database, returns a
// structured, validated result, or a reason it could not. Runs on the server only; the API key
// never reaches the browser.

export const CROP_HEALTH_MODEL = AI_MODEL;

/** AI help is offered only when the server has an API key (USER_WORKFLOWS.md 8: "if enabled"). */
export const isCropHealthAiEnabled = isAiEnabled;

export type AnalysisOutcome = { ok: true; result: CropHealthResult; model: string } | { ok: false; reason: AiFailure };

export type AnalysisPhoto = { data: Uint8Array; type: PhotoType };

export async function analyzeCropPhotos(photos: AnalysisPhoto[], context: AnalysisContext): Promise<AnalysisOutcome> {
  try {
    const response = await aiClient().beta.messages.parse({
      model: CROP_HEALTH_MODEL,
      max_tokens: 8000,
      ...aiFallback(),
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
    return { ok: false, reason: aiFailureFrom(error, "crop health") };
  }
}
