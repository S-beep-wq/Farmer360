"use client";

import { useActionState, useState } from "react";

import { FormError, SubmitButton, TextAreaField } from "@/components/ui/form";
import { initialFormState, type FormState } from "@/lib/forms";
import type { Messages } from "@/lib/i18n";

/** A farmer says they are interested, after agreeing to share their contact details. */
export function InterestForm({ t, action }: { t: Messages; action: (prev: FormState, formData: FormData) => Promise<FormState> }) {
  const [state, formAction] = useActionState(action, initialFormState);
  const v = state.values ?? {};
  const shareError = state.fieldErrors?.share_contact;
  const noteError = state.fieldErrors?.note;
  return (
    <form action={formAction} className="flex flex-col gap-4" noValidate>
      <TextAreaField
        name="note"
        label={t.market.noteLabel}
        hint={t.market.noteHint}
        optionalLabel={t.common.optional}
        maxLength={500}
        defaultValue={v.note}
        error={noteError && t.errors[noteError]}
      />
      <label className="flex min-h-14 items-start gap-3 rounded-xl border-2 border-stone-300 bg-white p-4 text-lg text-stone-900">
        <input
          key={v.share_contact ?? ""}
          type="checkbox"
          name="share_contact"
          value="yes"
          defaultChecked={v.share_contact === "yes"}
          className="mt-1 size-6 shrink-0 accent-green-700"
          aria-invalid={shareError ? true : undefined}
          aria-describedby={shareError ? "share-error" : undefined}
        />
        <span>{t.market.shareContactLabel}</span>
      </label>
      {shareError ? (
        <p id="share-error" className="text-lg font-medium text-red-700">
          {t.errors[shareError]}
        </p>
      ) : null}
      <FormError message={state.formError && t.errors[state.formError]} />
      <SubmitButton label={t.market.interested} pendingLabel={t.common.saving} />
    </form>
  );
}

/** One way of closing a demand (bought enough, or cancelled), with a confirmation step. */
function CloseButton({ t, label, action }: { t: Messages; label: string; action: () => Promise<FormState> }) {
  const [confirming, setConfirming] = useState(false);
  const [state, formAction] = useActionState(action, initialFormState);

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="min-h-14 w-full rounded-xl border-2 border-stone-400 bg-white px-6 text-xl font-semibold text-stone-800 hover:bg-stone-50 focus:outline-none focus:ring-4 focus:ring-stone-300"
      >
        {label}
      </button>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-3 rounded-xl border-2 border-amber-200 bg-amber-50 p-4">
      <p className="text-lg font-semibold text-stone-900">{label}</p>
      <p className="text-lg text-stone-800">{t.buyer.closeExplain}</p>
      <FormError message={state.formError && t.errors[state.formError]} />
      <SubmitButton label={t.buyer.closeConfirm} pendingLabel={t.common.saving} />
      <button
        type="button"
        onClick={() => setConfirming(false)}
        className="min-h-14 w-full rounded-xl border-2 border-green-700 bg-white px-6 text-xl font-semibold text-green-800 hover:bg-green-50"
      >
        {t.buyer.closeKeep}
      </button>
    </form>
  );
}

export function CloseDemand(props: { t: Messages; fulfil: () => Promise<FormState>; cancel: () => Promise<FormState> }) {
  return (
    <div className="flex flex-col gap-3">
      <CloseButton t={props.t} label={props.t.buyer.markFulfilled} action={props.fulfil} />
      <CloseButton t={props.t} label={props.t.buyer.cancelDemand} action={props.cancel} />
    </div>
  );
}
