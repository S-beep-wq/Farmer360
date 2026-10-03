"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { FormError } from "@/components/ui/form";
import { initialFormState } from "@/lib/forms";
import type { Messages } from "@/lib/i18n";

import { deleteAccountAction } from "../actions";

function DeleteButton({ t }: { t: Messages }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="min-h-14 w-full rounded-xl bg-red-700 px-6 text-xl font-semibold text-white hover:bg-red-800 focus:outline-none focus:ring-4 focus:ring-red-300 disabled:opacity-70"
    >
      {pending ? t.account.deleting : t.account.deleteConfirm}
    </button>
  );
}

/** Final confirmation: a box to tick, then a red button. "Keep" is offered unless deletion already started. */
export function DeleteAccountForm({ t, keepHref }: { t: Messages; keepHref?: string }) {
  const [state, formAction] = useActionState(deleteAccountAction, initialFormState);
  const confirmError = state.fieldErrors?.confirm;
  return (
    <form action={formAction} className="flex flex-col gap-4" noValidate>
      <label className="flex min-h-14 items-start gap-3 rounded-xl border-2 border-red-200 bg-red-50 p-4 text-lg text-stone-900">
        <input
          type="checkbox"
          name="confirm"
          value="yes"
          className="mt-1 size-6 shrink-0 accent-red-700"
          aria-invalid={confirmError ? true : undefined}
          aria-describedby={confirmError ? "confirm-error" : undefined}
        />
        <span>{t.account.deleteConfirmLabel}</span>
      </label>
      {confirmError ? (
        <p id="confirm-error" className="text-lg font-medium text-red-700">
          {t.errors[confirmError]}
        </p>
      ) : null}
      <FormError message={state.formError && t.errors[state.formError]} />
      <DeleteButton t={t} />
      {keepHref ? (
        <Link
          href={keepHref}
          className="flex min-h-14 w-full items-center justify-center rounded-xl border-2 border-green-700 bg-white px-6 text-xl font-semibold text-green-800 hover:bg-green-50 focus:outline-none focus:ring-4 focus:ring-green-300"
        >
          {t.account.deleteKeep}
        </Link>
      ) : null}
    </form>
  );
}
