"use client";

import { useActionState, useState } from "react";

import { ChoiceField, DateField, Field, FormError, SubmitButton, TextAreaField, TextField } from "@/components/ui/form";
import { QUANTITY_UNITS } from "@/features/shared/land";
import { initialFormState, type FormState } from "@/lib/forms";
import type { Messages } from "@/lib/i18n";

import { ACTIVITY_TYPES, EXPENSE_CATEGORIES } from "../constants";

type FormAction = (prev: FormState, formData: FormData) => Promise<FormState>;

const controlClass =
  "block min-h-14 rounded-xl border-2 border-stone-300 bg-white px-4 text-lg text-stone-900 " +
  "focus:border-green-700 focus:outline-none focus:ring-4 focus:ring-green-200 aria-[invalid=true]:border-red-600";

/** Optional quantity with its unit, side by side. */
function QuantityField({ t, values, error }: { t: Messages; values: Record<string, string>; error?: string }) {
  return (
    <Field label={t.records.quantityLabel} hint={t.records.quantityHint} optionalLabel={t.common.optional} error={error}>
      {({ id, describedBy, invalid }) => (
        <div className="flex gap-3">
          <input
            id={id}
            name="quantity"
            type="text"
            inputMode="decimal"
            defaultValue={values.quantity}
            aria-describedby={describedBy}
            aria-invalid={invalid}
            className={`${controlClass} w-full min-w-0 flex-1`}
          />
          <select
            // Remount when the saved unit changes, so React's form reset keeps it (see SelectField).
            key={values.quantity_unit ?? ""}
            name="quantity_unit"
            aria-label={t.records.unitLabel}
            defaultValue={values.quantity_unit ?? ""}
            className={`${controlClass} w-40 shrink-0 px-3`}
          >
            <option value="">{t.records.unitLabel}</option>
            {QUANTITY_UNITS.map((u) => (
              <option key={u} value={u}>
                {t.quantityUnits[u]}
              </option>
            ))}
          </select>
        </div>
      )}
    </Field>
  );
}

function useRecordForm(t: Messages, action: FormAction, initialValues: Record<string, string>) {
  const [state, formAction] = useActionState(action, initialFormState);
  const values = state.values ?? initialValues;
  const err = (field: string) => {
    const key = state.fieldErrors?.[field];
    return key ? t.errors[key] : undefined;
  };
  return { state, formAction, values, err };
}

type Props = { t: Messages; action: FormAction; today: string; initialValues: Record<string, string> };

/** Record work done on a crop (USER_WORKFLOWS.md section 7). */
export function ActivityForm({ t, action, today, initialValues }: Props) {
  const { state, formAction, values: v, err } = useRecordForm(t, action, initialValues);
  return (
    <form action={formAction} className="flex flex-col gap-6" noValidate>
      <ChoiceField
        legend={t.records.activityTypeLabel}
        name="activity_type"
        options={ACTIVITY_TYPES.map((a) => ({ value: a, label: t.activityTypes[a] }))}
        defaultValue={v.activity_type}
        error={err("activity_type")}
      />
      <DateField name="activity_date" label={t.records.dateLabel} max={today} defaultValue={v.activity_date} error={err("activity_date")} />
      <QuantityField t={t} values={v} error={err("quantity") ?? err("quantity_unit")} />
      <TextField
        name="cost"
        label={t.records.workCostLabel}
        hint={t.records.workCostHint}
        optionalLabel={t.common.optional}
        inputMode="decimal"
        defaultValue={v.cost}
        error={err("cost")}
      />
      <TextAreaField name="notes" label={t.records.notesLabel} optionalLabel={t.common.optional} maxLength={1000} defaultValue={v.notes} error={err("notes")} />
      <FormError message={state.formError && t.errors[state.formError]} />
      <SubmitButton label={t.records.saveWork} pendingLabel={t.common.saving} />
    </form>
  );
}

/** Record a cost for a crop (USER_WORKFLOWS.md section 12). */
export function ExpenseForm({ t, action, today, initialValues }: Props) {
  const { state, formAction, values: v, err } = useRecordForm(t, action, initialValues);
  return (
    <form action={formAction} className="flex flex-col gap-6" noValidate>
      <ChoiceField
        legend={t.records.categoryLabel}
        name="category"
        options={EXPENSE_CATEGORIES.map((c) => ({ value: c, label: t.expenseCategories[c] }))}
        defaultValue={v.category}
        error={err("category")}
      />
      <p className="rounded-xl bg-amber-50 p-4 text-base text-amber-900">{t.records.doubleCountHint}</p>
      <TextField name="amount" label={t.records.amountLabel} inputMode="decimal" defaultValue={v.amount} error={err("amount")} />
      <DateField name="expense_date" label={t.records.dateLabel} max={today} defaultValue={v.expense_date} error={err("expense_date")} />
      <QuantityField t={t} values={v} error={err("quantity") ?? err("quantity_unit")} />
      <TextField name="vendor" label={t.records.vendorLabel} optionalLabel={t.common.optional} maxLength={100} defaultValue={v.vendor} error={err("vendor")} />
      <TextAreaField name="notes" label={t.records.notesLabel} optionalLabel={t.common.optional} maxLength={1000} defaultValue={v.notes} error={err("notes")} />
      <FormError message={state.formError && t.errors[state.formError]} />
      <SubmitButton label={t.records.saveCost} pendingLabel={t.common.saving} />
    </form>
  );
}

/** "Remove this entry", then a second tap to confirm. */
export function RemoveEntry({ t, action }: { t: Messages; action: () => Promise<FormState> }) {
  const [confirming, setConfirming] = useState(false);
  const [state, formAction] = useActionState(action, initialFormState);

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="min-h-14 w-full rounded-xl border-2 border-red-700 bg-white px-6 text-xl font-semibold text-red-800 hover:bg-red-50 focus:outline-none focus:ring-4 focus:ring-red-300"
      >
        {t.records.remove}
      </button>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-3 rounded-xl border-2 border-red-200 bg-red-50 p-4">
      <p className="text-lg text-red-900">{t.records.removeExplain}</p>
      <FormError message={state.formError && t.errors[state.formError]} />
      <button
        type="submit"
        className="min-h-14 w-full rounded-xl bg-red-700 px-6 text-xl font-semibold text-white hover:bg-red-800 focus:outline-none focus:ring-4 focus:ring-red-300"
      >
        {t.records.removeConfirm}
      </button>
      <button
        type="button"
        onClick={() => setConfirming(false)}
        className="min-h-14 w-full rounded-xl border-2 border-green-700 bg-white px-6 text-xl font-semibold text-green-800 hover:bg-green-50"
      >
        {t.records.removeKeep}
      </button>
    </form>
  );
}
