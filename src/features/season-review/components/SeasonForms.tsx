"use client";

import { useActionState } from "react";

import { ChoiceField, FormError, SubmitButton, TextAreaField } from "@/components/ui/form";
import { PAYMENT_STATUSES } from "@/features/harvest-sales/constants";
import { initialFormState, type FormState } from "@/lib/forms";
import type { Messages } from "@/lib/i18n";

type FormAction = (prev: FormState, formData: FormData) => Promise<FormState>;

/** Notes for next season, the reminders, and the button that closes the crop. */
export function SeasonReviewForm({ t, action, reminders }: { t: Messages; action: FormAction; reminders: string[] }) {
  const [state, formAction] = useActionState(action, initialFormState);
  const err = state.fieldErrors?.notes;
  return (
    <form action={formAction} className="flex flex-col gap-6" noValidate>
      {reminders.length > 0 ? (
        <section className="rounded-xl border-2 border-amber-300 bg-amber-50 p-4" aria-labelledby="reminders-title">
          <h2 id="reminders-title" className="text-lg font-semibold text-amber-950">
            {t.review.remindersTitle}
          </h2>
          <ul className="mt-2 flex list-disc flex-col gap-1 pl-5 text-base text-amber-950" data-testid="review-reminders">
            {reminders.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        </section>
      ) : null}
      <TextAreaField
        name="notes"
        label={t.review.notesLabel}
        hint={t.review.notesHint}
        optionalLabel={t.common.optional}
        maxLength={1000}
        defaultValue={state.values?.notes}
        error={err ? t.errors[err] : undefined}
      />
      <p className="text-base text-stone-700">{t.review.intro}</p>
      <FormError message={state.formError && t.errors[state.formError]} />
      <SubmitButton label={t.review.save} pendingLabel={t.common.saving} />
    </form>
  );
}

/** Payment status only: what can still change on a sale after the season is closed. */
export function SalePaymentForm({ t, action, current }: { t: Messages; action: FormAction; current: string }) {
  const [state, formAction] = useActionState(action, initialFormState);
  const err = state.fieldErrors?.payment_status;
  return (
    <form action={formAction} className="flex flex-col gap-6" noValidate>
      <ChoiceField
        legend={t.sales.paymentLabel}
        name="payment_status"
        options={PAYMENT_STATUSES.map((p) => ({ value: p, label: t.paymentStatuses[p] }))}
        defaultValue={state.values?.payment_status ?? current}
        error={err ? t.errors[err] : undefined}
      />
      <FormError message={state.formError && t.errors[state.formError]} />
      <SubmitButton label={t.review.savePayment} pendingLabel={t.common.saving} />
    </form>
  );
}
