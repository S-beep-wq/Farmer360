"use client";

import { useActionState } from "react";

import { ChoiceField, DateField, FormError, SelectField, SubmitButton, TextAreaField, TextField } from "@/components/ui/form";
import { cropName } from "@/features/crops/format";
import type { Crop } from "@/features/crops/repository";
import { ProduceQuantityField } from "@/features/harvest-sales/components/HarvestSaleForms";
import { initialFormState, type FormState } from "@/lib/forms";
import type { Locale, Messages } from "@/lib/i18n";

type Props = {
  t: Messages;
  locale: Locale;
  crops: Crop[];
  today: string;
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  initialValues: Record<string, string>;
};

/** Publish what a buyer wants to buy (USER_WORKFLOWS.md section 14, buyer side). */
export function DemandForm({ t, locale, crops, today, action, initialValues }: Props) {
  const [state, formAction] = useActionState(action, initialFormState);
  const v = state.values ?? initialValues;
  const err = (field: string) => {
    const key = state.fieldErrors?.[field];
    return key ? t.errors[key] : undefined;
  };

  return (
    <form action={formAction} className="flex flex-col gap-6" noValidate>
      <SelectField
        name="crop_id"
        label={t.buyer.cropLabel}
        placeholder={t.common.choose}
        options={crops.map((c) => ({ value: c.id, label: cropName(c, locale) }))}
        defaultValue={v.crop_id}
        error={err("crop_id")}
      />
      <ProduceQuantityField t={t} label={t.buyer.quantityLabel} values={v} error={err("quantity") ?? err("quantity_unit")} />
      <div className="flex flex-col gap-2">
        <ChoiceField
          key={`type-${v.demand_type ?? ""}`}
          legend={t.buyer.demandTypeLabel}
          name="demand_type"
          options={[
            { value: "CONFIRMED", label: t.buyer.demandTypeConfirmed },
            { value: "INDICATIVE", label: t.buyer.demandTypeIndicative },
          ]}
          defaultValue={v.demand_type}
          error={err("demand_type")}
        />
        <p className="text-base text-stone-600">{t.buyer.demandTypeHint}</p>
      </div>
      <TextAreaField
        name="quality_requirements"
        label={t.buyer.qualityLabel}
        hint={t.buyer.qualityHint}
        optionalLabel={t.common.optional}
        maxLength={500}
        defaultValue={v.quality_requirements}
        error={err("quality_requirements")}
      />
      <DateField name="required_date" label={t.buyer.requiredDateLabel} min={today} defaultValue={v.required_date} error={err("required_date")} />
      <TextField name="location" label={t.buyer.placeLabel} maxLength={100} defaultValue={v.location} error={err("location")} />
      <TextField name="district" label={t.buyer.districtLabel} maxLength={100} defaultValue={v.district} error={err("district")} />
      <TextField name="state" label={t.buyer.stateLabel} maxLength={100} defaultValue={v.state} error={err("state")} />
      <ChoiceField
        key={`pickup-${v.pickup_available ?? ""}`}
        legend={t.buyer.pickupLabel}
        name="pickup_available"
        options={[
          { value: "yes", label: t.common.yes },
          { value: "no", label: t.common.no },
        ]}
        defaultValue={v.pickup_available}
        error={err("pickup_available")}
      />
      <TextField
        name="payment_terms"
        label={t.buyer.paymentTermsLabel}
        hint={t.buyer.paymentTermsHint}
        optionalLabel={t.common.optional}
        maxLength={300}
        defaultValue={v.payment_terms}
        error={err("payment_terms")}
      />
      <FormError message={state.formError && t.errors[state.formError]} />
      <SubmitButton label={t.buyer.publish} pendingLabel={t.common.saving} />
    </form>
  );
}
