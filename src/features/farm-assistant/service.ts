import "server-only";

import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";

import { AI_MODEL, aiClient, aiFailureFrom, aiFallback, type AiFailure } from "@/lib/ai";

import { contextText, type FarmContext } from "./context";
import { SYSTEM_PROMPT } from "./prompt";
import { normalizeAnswer } from "./rules";
import { assistantAnswerSchema, type AssistantAnswer } from "./schema";

// The farm assistant's AI call (SYSTEM_ARCHITECTURE.md section 10): one question, the farm's
// records as context, a structured and checked answer back.

export type AskOutcome = { ok: true; answer: AssistantAnswer; model: string } | { ok: false; reason: AiFailure };

export async function askFarmAssistant(question: string, context: FarmContext): Promise<AskOutcome> {
  try {
    const response = await aiClient().beta.messages.parse({
      model: AI_MODEL,
      max_tokens: 8000,
      ...aiFallback(),
      thinking: { type: "adaptive" },
      output_config: { effort: "medium", format: betaZodOutputFormat(assistantAnswerSchema) },
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: contextText(context, question) }],
    });
    if (response.stop_reason === "refusal") return { ok: false, reason: "refused" };
    if (response.stop_reason === "max_tokens" || !response.parsed_output) return { ok: false, reason: "invalid" };
    return { ok: true, answer: normalizeAnswer(response.parsed_output), model: response.model };
  } catch (error) {
    return { ok: false, reason: aiFailureFrom(error, "farm assistant") };
  }
}
