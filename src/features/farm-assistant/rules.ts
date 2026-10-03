import type { AssistantAnswer } from "./schema";

// Applied to every answer before it is shown (USER_WORKFLOWS.md section 18): only ever more cautious.

export const DAILY_QUESTION_LIMIT = 30;
const MAX_ANSWER = 2000;
const MAX_ITEM = 300;

const clip = (s: string, max: number) => (s.length > max ? `${s.slice(0, max - 1)}…` : s).trim();
const items = (list: string[], max: number) => list.map((i) => clip(i, MAX_ITEM)).filter(Boolean).slice(0, max);

export function normalizeAnswer(raw: AssistantAnswer): AssistantAnswer {
  const a: AssistantAnswer = {
    answer: clip(raw.answer, MAX_ANSWER),
    based_on: items(raw.based_on, 5),
    missing_information: items(raw.missing_information, 3),
    confidence: raw.confidence,
    see_expert: raw.see_expert,
    expert_reason: raw.expert_reason ? clip(raw.expert_reason, MAX_ITEM) : null,
  };
  // Unsure and nothing to ask: an expert is the next step.
  if (a.confidence === "LOW" && a.missing_information.length === 0) a.see_expert = true;
  // An answer that does not rest on any of the farmer's records cannot be very sure about their farm.
  if (a.based_on.length === 0 && a.confidence === "HIGH") a.confidence = "MEDIUM";
  return a;
}
