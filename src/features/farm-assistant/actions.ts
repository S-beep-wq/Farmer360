"use server";

import { todayInIndia } from "@/features/crops/dates";
import { isId } from "@/features/farms/schema";
import { isAiEnabled } from "@/lib/ai";
import { requireFarmer } from "@/lib/auth";
import { fieldErrorsFrom, formValues, type FormState } from "@/lib/forms";
import type { ErrorKey } from "@/lib/i18n";
import { getLocale } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";

import { countQuestionsToday, loadFarmContext, recordQuestion, setQuestionFeedback } from "./repository";
import { DAILY_QUESTION_LIMIT } from "./rules";
import { questionSchema, type AssistantAnswer } from "./schema";
import { askFarmAssistant } from "./service";
import { withWeather } from "./weather";

export type AssistantState = FormState & { answer?: AssistantAnswer; interactionId?: string };

const FAILURE: Record<"refused" | "unavailable" | "invalid", ErrorKey> = {
  refused: "aiRefused",
  unavailable: "aiUnavailable",
  invalid: "aiUnavailable",
};

const FEEDBACK = ["HELPFUL", "NOT_HELPFUL", "NOT_SURE"] as const;

/** A farmer's question about their farm (USER_WORKFLOWS.md section 17). Asking is consent to send it. */
export async function askAction(_prev: AssistantState, formData: FormData): Promise<AssistantState> {
  const farmer = await requireFarmer();
  const values = formValues(formData);
  if (!isAiEnabled()) return { formError: "aiUnavailable", values };
  const parsed = questionSchema.safeParse(values);
  if (!parsed.success) return { fieldErrors: fieldErrorsFrom(parsed.error), values };

  const supabase = await createClient();
  const today = todayInIndia();
  if ((await countQuestionsToday(supabase, `${today}T00:00:00+05:30`)) >= DAILY_QUESTION_LIMIT) {
    return { formError: "aiQuestionLimit", values };
  }

  const locale = await getLocale();
  const context = await loadFarmContext(supabase, {
    locale,
    today,
    district: farmer.district,
    state: farmer.state,
    cropCycleId: parsed.data.crop_cycle_id,
  });
  if (!context) return { fieldErrors: { crop_cycle_id: "invalidChoice" }, values };

  const outcome = await askFarmAssistant(parsed.data.question, await withWeather(context));
  if (!outcome.ok) return { formError: FAILURE[outcome.reason], values };

  const { id, error } = await recordQuestion(supabase, {
    model: outcome.model,
    confidence: outcome.answer.confidence,
    asked_for_information: outcome.answer.missing_information.length > 0,
    see_expert: outcome.answer.see_expert,
    about_one_crop: context.oneCrop,
  });
  if (error) {
    console.error("farm assistant: recording the question failed", { farmerId: farmer.id, code: error.code });
    if (error.message.includes("question_limit_day")) return { formError: "aiQuestionLimit", values };
  }
  // The answer is shown even if only the metadata could not be saved.
  return { answer: outcome.answer, interactionId: id, values };
}

export async function questionFeedbackAction(interactionId: string, feedback: string): Promise<FormState> {
  await requireFarmer();
  if (!isId(interactionId) || !(FEEDBACK as readonly string[]).includes(feedback)) return { formError: "generic" };
  const { updated, error } = await setQuestionFeedback(await createClient(), interactionId, feedback);
  if (error || !updated) return { formError: "generic" };
  return {};
}
