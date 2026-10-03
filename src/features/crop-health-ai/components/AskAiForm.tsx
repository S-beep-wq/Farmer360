"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { FormError } from "@/components/ui/form";
import { initialFormState, type FormState } from "@/lib/forms";
import type { Messages } from "@/lib/i18n";

function AskButton({ t, again }: { t: Messages; again: boolean }) {
  const { pending } = useFormStatus();
  return (
    <>
      <button
        type="submit"
        disabled={pending}
        className="min-h-14 w-full rounded-xl bg-green-700 px-6 text-xl font-semibold text-white hover:bg-green-800 focus:outline-none focus:ring-4 focus:ring-green-300 disabled:opacity-70"
      >
        {again ? t.cropHealthAi.askAgain : t.cropHealthAi.ask}
      </button>
      {pending ? (
        <p role="status" className="text-lg text-stone-700">
          {t.cropHealthAi.asking}
        </p>
      ) : null}
    </>
  );
}

/** The farmer's explicit request (and consent) to send this observation's photo to the AI. */
export function AskAiForm({ t, action, again }: { t: Messages; action: () => Promise<FormState>; again: boolean }) {
  const [state, formAction] = useActionState(action, initialFormState);
  return (
    <form action={formAction} className="flex flex-col gap-3">
      <p className="text-base text-stone-700">{t.cropHealthAi.consent}</p>
      <FormError message={state.formError && t.errors[state.formError]} />
      <AskButton t={t} again={again} />
    </form>
  );
}

/** "Did this help?" with three answers. */
export function FeedbackForm({ t, action }: { t: Messages; action: (feedback: string) => Promise<FormState> }) {
  const [state, formAction] = useActionState((_prev: FormState, formData: FormData) => action(String(formData.get("feedback"))), initialFormState);
  const options = [
    { value: "HELPFUL", label: t.cropHealthAi.feedbackHelpful },
    { value: "NOT_HELPFUL", label: t.cropHealthAi.feedbackNotHelpful },
    { value: "NOT_SURE", label: t.cropHealthAi.feedbackNotSure },
  ];
  return (
    <form action={formAction} className="flex flex-col gap-2">
      <p className="text-lg font-semibold text-stone-900">{t.cropHealthAi.feedbackQuestion}</p>
      <div className="grid grid-cols-3 gap-2">
        {options.map((o) => (
          <button
            key={o.value}
            type="submit"
            name="feedback"
            value={o.value}
            className="min-h-12 rounded-xl border-2 border-stone-300 bg-white px-2 text-lg font-medium text-stone-900 hover:border-green-700 focus:outline-none focus:ring-4 focus:ring-green-300"
          >
            {o.label}
          </button>
        ))}
      </div>
      <FormError message={state.formError && t.errors[state.formError]} />
    </form>
  );
}
