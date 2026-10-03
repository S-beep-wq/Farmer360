import { z } from "zod";

import { LEVELS } from "@/features/crop-health-ai/schema";

// The assistant's structured answer (USER_WORKFLOWS.md section 17): the answer itself, which of
// the farmer's records it used, what is missing (asked back to the farmer instead of guessed),
// how sure it is, and whether to see an expert.

export const assistantAnswerSchema = z.object({
  answer: z.string().describe("Short, plain answer for the farmer, in the requested language."),
  based_on: z.array(z.string()).describe("Which of the farmer's records the answer uses, in a few words each."),
  missing_information: z
    .array(z.string())
    .describe("Questions for the farmer about things the records do not show and that matter for the answer."),
  confidence: z.enum(LEVELS),
  see_expert: z.boolean(),
  expert_reason: z.string().nullable(),
});

export type AssistantAnswer = z.infer<typeof assistantAnswerSchema>;

/** What the farmer types: a question, and optionally which crop it is about. */
export const questionSchema = z.object({
  question: z.string({ error: "required" }).trim().min(3, "required").max(500, "tooLong"),
  crop_cycle_id: z
    .union([z.literal(""), z.uuid({ error: "invalidChoice" })])
    .optional()
    .transform((v) => (v ? v : undefined)),
});
