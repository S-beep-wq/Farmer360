"use client";

import { useActionState } from "react";

import { ChoiceField, DateField, Field, FormError, SubmitButton, TextAreaField, TextField } from "@/components/ui/form";
import { initialFormState, type FormState } from "@/lib/forms";
import type { Messages } from "@/lib/i18n";

import { BUYER_TYPES, PAYMENT_STATUSES, PRODUCE_UNITS, QUALITY_GRADES } from "../constants";

type FormAction = (prev: FormState, formData: FormData) => Promise<FormState>;

const controlClass =
  "block min-h-14 rounded-xl border-2 border-stone-300 bg-white px-4 text-lg text-stone-900 " +
  "focus:border-green-700 focus:outline-none focus:ring-4 focus:ring-green-200 aria-[invalid=true]:border-red-600";

/** Required quantity of produce with its unit (kg, quintal, tonne). */
function ProduceQuantityField(props: { t: Messages; label: string; hint?: string; values: Record<string, string>; error?: string }) {
  const { t, values } = props;
  return (
    <Field label={props.label} hint={props.hint} error={props.error}>
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
            aria-label={t.harvests.unitLabel}
            defaultValue={values.quantity_unit ?? ""}
            className={`${controlClass} w-40 shrink-0 px-3`}
          >
            <option value="">{t.harvests.unitLabel}</option>
            {PRODUCE_UNITS.map((u) => (
              <option key={u} value={u}>
                {t.produceUnits[u]}
              </option>
            ))}
          </select>
        </div>
      )}
    </Field>
  );
}

function useEntryForm(t: Messages, action: FormAction, initialValues: Record<string, string>) {
  const [state, formAction] = useActionState(action, initialFormState);
  const values = state.values ?? initialValues;
  const err = (field: string) => {
    const key = state.fieldErrors?.[field];
    return key ? t.errors[key] : undefined;
  };
  return { state, formAction, values, err };
}

type Props = { t: Messages; action: FormAction; today: string; initialValues: Record<string, string> };

/** Record a harvest (USER_WORKFLOWS.md section 13). */
export function HarvestForm({ t, action, today, initialValues, minDate }: Props & { minDate: string }) {
  const { state, formAction, values: v, err } = useEntryForm(t, action, initialValues);
  return (
    <form action={formAction} className="flex flex-col gap-6" noValidate>
      <DateField name="harvest_date" label={t.harvests.dateLabel} min={minDate} max={today} defaultValue={v.harvest_date} error={err("harvest_date")} />
      <ProduceQuantityField t={t} label={t.harvests.quantityLabel} values={v} error={err("quantity") ?? err("quantity_unit")} />
      <ChoiceField
        legend={t.harvests.qualityLabel}
        name="quality_grade"
        optionalLabel={t.common.optional}
        options={QUALITY_GRADES.map((q) => ({ value: q, label: t.qualityGrades[q] }))}
        defaultValue={v.quality_grade}
        error={err("quality_grade")}
      />
      <TextAreaField name="notes" label={t.records.notesLabel} optionalLabel={t.common.optional} maxLength={1000} defaultValue={v.notes} error={err("notes")} />
      <FormError message={state.formError && t.errors[state.formError]} />
      <SubmitButton label={t.harvests.save} pendingLabel={t.common.saving} />
    </form>
  );
}

/** Record a sale from a harvest (USER_WORKFLOWS.md section 15). */
export function SaleForm({ t, action, today, initialValues, minDate, availableText }: Props & { minDate: string; availableText: string }) {
  const { state, formAction, values: v, err } = useEntryForm(t, action, initialValues);
  return (
    <form action={formAction} className="flex flex-col gap-6" noValidate>
      <ChoiceField
        legend={t.sales.buyerTypeLabel}
        name="buyer_type"
        options={BUYER_TYPES.map((b) => ({ value: b, label: t.buyerTypes[b] }))}
        defaultValue={v.buyer_type}
        error={err("buyer_type")}
      />
      <TextField
        name="buyer_name"
        label={t.sales.buyerNameLabel}
        hint={t.sales.buyerNameHint}
        optionalLabel={t.common.optional}
        maxLength={100}
        defaultValue={v.buyer_name}
        error={err("buyer_name")}
      />
      <ProduceQuantityField t={t} label={t.sales.quantityLabel} hint={availableText} values={v} error={err("quantity") ?? err("quantity_unit")} />
      <TextField name="price_per_unit" label={t.sales.priceLabel} hint={t.sales.priceHint} inputMode="decimal" defaultValue={v.price_per_unit} error={err("price_per_unit")} />
      <DateField name="sale_date" label={t.sales.dateLabel} min={minDate} max={today} defaultValue={v.sale_date} error={err("sale_date")} />
      <TextField
        name="transport_cost"
        label={t.sales.transportLabel}
        optionalLabel={t.common.optional}
        inputMode="decimal"
        defaultValue={v.transport_cost}
        error={err("transport_cost")}
      />
      <TextField
        name="other_cost"
        label={t.sales.otherCostLabel}
        hint={t.sales.otherCostHint}
        optionalLabel={t.common.optional}
        inputMode="decimal"
        defaultValue={v.other_cost}
        error={err("other_cost")}
      />
      <ChoiceField
        legend={t.sales.paymentLabel}
        name="payment_status"
        options={PAYMENT_STATUSES.map((p) => ({ value: p, label: t.paymentStatuses[p] }))}
        defaultValue={v.payment_status}
        error={err("payment_status")}
      />
      <TextAreaField name="notes" label={t.records.notesLabel} optionalLabel={t.common.optional} maxLength={1000} defaultValue={v.notes} error={err("notes")} />
      <FormError message={state.formError && t.errors[state.formError]} />
      <SubmitButton label={t.sales.save} pendingLabel={t.common.saving} />
    </form>
  );
}
