"use client";

import { useActionState } from "react";

import { FormError, SubmitButton, TextField } from "@/components/ui/form";
import { initialFormState } from "@/lib/forms";
import type { Messages } from "@/lib/i18n";

import { LandDetailsFields } from "@/features/shared/components/LandDetailsFields";

import { createFarmAction } from "../actions";

export function FarmForm({ t, defaultVillage }: { t: Messages; defaultVillage: string }) {
  const [state, action] = useActionState(createFarmAction, initialFormState);
  const v = state.values ?? {};
  const err = (field: string) => {
    const key = state.fieldErrors?.[field];
    return key ? t.errors[key] : undefined;
  };

  return (
    <form action={action} className="flex flex-col gap-6" noValidate>
      <TextField name="name" label={t.farms.nameLabel} hint={t.farms.nameHint} maxLength={100} defaultValue={v.name} error={err("name")} />
      <TextField
        name="village"
        label={t.farms.villageLabel}
        optionalLabel={t.common.optional}
        maxLength={100}
        defaultValue={v.village ?? defaultVillage}
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
      <SubmitButton label={t.farms.create} pendingLabel={t.common.saving} />
    </form>
  );
}
