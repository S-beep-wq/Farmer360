"use client";

import { useActionState, useState, useTransition } from "react";
import { useFormStatus } from "react-dom";

import { FormError, SelectField } from "@/components/ui/form";
import { format, type Messages } from "@/lib/i18n";

import { askAction, questionFeedbackAction, type AssistantState } from "../actions";
import type { AssistantCrop } from "../repository";
import type { AssistantAnswer } from "../schema";

const controlClass =
  "block w-full rounded-xl border-2 border-stone-300 bg-white px-4 py-3 text-lg text-stone-900 " +
  "focus:border-green-700 focus:outline-none focus:ring-4 focus:ring-green-200 aria-[invalid=true]:border-red-600";

function AskButton({ t }: { t: Messages }) {
  const { pending } = useFormStatus();
  return (
    <>
      <button
        type="submit"
        disabled={pending}
        className="min-h-14 w-full rounded-xl bg-green-700 px-6 text-xl font-semibold text-white hover:bg-green-800 focus:outline-none focus:ring-4 focus:ring-green-300 disabled:opacity-70"
      >
        {t.assistant.ask}
      </button>
      {pending ? (
        <p role="status" className="text-lg text-stone-700">
          {t.assistant.asking}
        </p>
      ) : null}
    </>
  );
}

function Feedback({ t, interactionId }: { t: Messages; interactionId: string }) {
  const [given, setGiven] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const options = [
    { value: "HELPFUL", label: t.cropHealthAi.feedbackHelpful },
    { value: "NOT_HELPFUL", label: t.cropHealthAi.feedbackNotHelpful },
    { value: "NOT_SURE", label: t.cropHealthAi.feedbackNotSure },
  ];
  if (given) {
    return (
      <p role="status" className="text-lg text-stone-800">
        {format(t.cropHealthAi.feedbackThanks, { answer: options.find((o) => o.value === given)?.label ?? given })}
      </p>
    );
  }
  return (
    <div className="flex flex-col gap-2">
      <p className="text-lg font-semibold text-stone-900">{t.cropHealthAi.feedbackQuestion}</p>
      <div className="grid grid-cols-3 gap-2">
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                const result = await questionFeedbackAction(interactionId, o.value);
                if (!result.formError) setGiven(o.value);
              })
            }
            className="min-h-12 rounded-xl border-2 border-stone-300 bg-white px-2 text-lg font-medium text-stone-900 hover:border-green-700 focus:outline-none focus:ring-4 focus:ring-green-300"
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

/** The answer, with its uncertainty and limits shown (USER_WORKFLOWS.md section 18). */
function Answer({ t, answer, interactionId }: { t: Messages; answer: AssistantAnswer; interactionId?: string }) {
  const confidence = { HIGH: t.cropHealthAi.confidenceHigh, MEDIUM: t.cropHealthAi.confidenceMedium, LOW: t.cropHealthAi.confidenceLow }[answer.confidence];
  const colour = { HIGH: "bg-green-100 text-green-900", MEDIUM: "bg-amber-100 text-amber-900", LOW: "bg-red-100 text-red-900" }[answer.confidence];
  return (
    <section data-testid="assistant-answer" aria-live="polite" className="flex flex-col gap-4 rounded-2xl border-2 border-blue-200 bg-blue-50/40 p-5">
      <h2 className="text-2xl font-semibold text-stone-900">{t.assistant.answerTitle}</h2>
      <span data-testid="assistant-confidence" className={`inline-flex min-h-8 w-fit items-center rounded-full px-3 text-base font-semibold ${colour}`}>
        {confidence}
      </span>
      <p className="whitespace-pre-line text-lg text-stone-900">{answer.answer}</p>

      {answer.based_on.length > 0 ? (
        <section className="flex flex-col gap-1" data-testid="assistant-based-on">
          <h3 className="text-lg font-semibold text-stone-900">{t.assistant.basedOn}</h3>
          <ul className="list-disc pl-6 text-lg text-stone-800">
            {answer.based_on.map((b) => (
              <li key={b}>{b}</li>
            ))}
          </ul>
        </section>
      ) : (
        <p className="text-base text-stone-700">{t.assistant.noRecords}</p>
      )}

      {answer.missing_information.length > 0 ? (
        <section className="flex flex-col gap-1 rounded-xl border-2 border-amber-200 bg-amber-50 p-4" data-testid="assistant-missing">
          <h3 className="text-lg font-semibold text-amber-900">{t.assistant.missingTitle}</h3>
          <ul className="list-disc pl-6 text-lg text-amber-900">
            {answer.missing_information.map((m) => (
              <li key={m}>{m}</li>
            ))}
          </ul>
          <p className="text-base text-amber-900">{t.assistant.missingHint}</p>
        </section>
      ) : null}

      {answer.see_expert ? (
        <section className="flex flex-col gap-1 rounded-xl border-2 border-red-200 bg-red-50 p-4" data-testid="assistant-expert">
          <h3 className="text-lg font-semibold text-red-900">{t.cropHealthAi.expertTitle}</h3>
          {answer.expert_reason ? <p className="text-lg text-red-900">{answer.expert_reason}</p> : null}
          <p className="text-base text-red-900">{t.cropHealthAi.expertWhere}</p>
        </section>
      ) : null}

      <p className="text-base text-stone-700" data-testid="assistant-disclaimer">
        {t.assistant.disclaimer}
      </p>
      {interactionId ? <Feedback key={interactionId} t={t} interactionId={interactionId} /> : null}
    </section>
  );
}

export function AssistantForm({ t, crops, defaultCrop }: { t: Messages; crops: AssistantCrop[]; defaultCrop?: string }) {
  const [state, formAction] = useActionState(askAction, {} as AssistantState);
  const v = state.values ?? { crop_cycle_id: defaultCrop ?? "" };
  const [question, setQuestion] = useState(v.question ?? "");
  const err = (field: string) => {
    const key = state.fieldErrors?.[field];
    return key ? t.errors[key] : undefined;
  };
  const examples = [t.assistant.exampleToday, t.assistant.exampleYellow, t.assistant.exampleHarvest];

  return (
    <>
      <form action={formAction} className="flex flex-col gap-5" noValidate>
        {crops.length > 0 ? (
          <SelectField
            name="crop_cycle_id"
            label={t.assistant.cropLabel}
            placeholder={t.assistant.wholeFarm}
            options={crops.map((c) => ({ value: c.id, label: c.label }))}
            defaultValue={v.crop_cycle_id}
            error={err("crop_cycle_id")}
          />
        ) : null}
        <div className="flex flex-col gap-2">
          <label htmlFor="assistant-question" className="text-lg font-semibold text-stone-900">
            {t.assistant.questionLabel}
          </label>
          <textarea
            id="assistant-question"
            name="question"
            rows={3}
            maxLength={500}
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            aria-invalid={err("question") ? true : undefined}
            aria-describedby={err("question") ? "assistant-question-error" : undefined}
            className={controlClass}
          />
          {err("question") ? (
            <p id="assistant-question-error" role="alert" className="text-base font-medium text-red-700">
              {err("question")}
            </p>
          ) : null}
          <p className="text-base text-stone-600">{t.assistant.examplesLabel}</p>
          <div className="flex flex-wrap gap-2">
            {examples.map((e) => (
              <button
                key={e}
                type="button"
                onClick={() => setQuestion(e)}
                className="min-h-12 rounded-full border-2 border-green-700 bg-white px-4 text-base font-medium text-green-800 hover:bg-green-50 focus:outline-none focus:ring-4 focus:ring-green-300"
              >
                {e}
              </button>
            ))}
          </div>
        </div>
        <p className="text-base text-stone-700">{t.assistant.consent}</p>
        <FormError message={state.formError && t.errors[state.formError]} />
        <AskButton t={t} />
      </form>
      {state.answer ? <Answer key={state.interactionId ?? "answer"} t={t} answer={state.answer} interactionId={state.interactionId} /> : null}
    </>
  );
}
