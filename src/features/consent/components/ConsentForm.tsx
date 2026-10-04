"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { FormError } from "@/components/ui/form";
import { initialFormState } from "@/lib/forms";
import type { Messages } from "@/lib/i18n";

import { acceptNoticeAction } from "../actions";

function AgreeButton({ t }: { t: Messages }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="min-h-14 w-full rounded-xl bg-green-700 px-6 text-xl font-semibold text-white shadow-sm hover:bg-green-800 focus:outline-none focus:ring-4 focus:ring-green-300 disabled:opacity-70"
    >
      {pending ? t.consent.agreeing : t.consent.agree}
    </button>
  );
}

/** A box to tick, then "Agree and continue". */
export function ConsentForm({ t }: { t: Messages }) {
  const [state, formAction] = useActionState(acceptNoticeAction, initialFormState);
  const agreeError = state.fieldErrors?.agree;
  return (
    <form action={formAction} className="flex flex-col gap-4" noValidate>
      <label className="flex min-h-14 items-start gap-3 rounded-xl border-2 border-green-200 bg-green-50 p-4 text-lg text-stone-900">
        <input
          type="checkbox"
          name="agree"
          value="yes"
          className="mt-1 size-6 shrink-0 accent-green-700"
          aria-invalid={agreeError ? true : undefined}
          aria-describedby={agreeError ? "agree-error" : undefined}
        />
        <span>{t.consent.agreeLabel}</span>
      </label>
      {agreeError ? (
        <p id="agree-error" className="text-lg font-medium text-red-700">
          {t.errors[agreeError]}
        </p>
      ) : null}
      <FormError message={state.formError && t.errors[state.formError]} />
      <AgreeButton t={t} />
    </form>
  );
}
