"use client";

import { useActionState } from "react";

import { FormError, SubmitButton, TextField } from "@/components/ui/form";
import { LandDetailsFields } from "@/features/shared/components/LandDetailsFields";
import { initialFormState, type FormState } from "@/lib/forms";
import type { Messages } from "@/lib/i18n";

type Props = {
  t: Messages;
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  /** Prefilled values: the farmer's village for a new farm, the saved farm when editing. */
  initialValues: Record<string, string>;
  submitLabel: string;
};

/** Used to add a farm and to change a farm's details. */
export function FarmForm({ t, action, initialValues, submitLabel }: Props) {
  const [state, formAction] = useActionState(action, initialFormState);
  const v = state.values ?? initialValues;
  const err = (field: string) => {
    const key = state.fieldErrors?.[field];
    return key ? t.errors[key] : undefined;
  };

  return (
    <form action={formAction} className="flex flex-col gap-6" noValidate>
      <TextField name="name" label={t.farms.nameLabel} hint={t.farms.nameHint} maxLength={100} defaultValue={v.name} error={err("name")} />
      <TextField
        name="village"
        label={t.farms.villageLabel}
        optionalLabel={t.common.optional}
        maxLength={100}
        defaultValue={v.village}
        error={err("village")}
      />
      <LandDetailsFields
        t={t}
        values={v}
        errors={state.fieldErrors}
        areaField="total_area"
        areaLabel={t.farms.areaLabel}
      />
      <FormError message={state.formError && t.errors[state.formError]} />
      <SubmitButton label={submitLabel} pendingLabel={t.common.saving} />
    </form>
  );
}
