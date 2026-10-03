"use client";

import { useActionState } from "react";

import { ChoiceField, FormError, SubmitButton, TextField } from "@/components/ui/form";
import { initialFormState } from "@/lib/forms";
import { LOCALES, type Locale, type Messages } from "@/lib/i18n";

import { createFarmerProfileAction } from "../actions";

export function ProfileForm({ t, locale }: { t: Messages; locale: Locale }) {
  const [state, action] = useActionState(createFarmerProfileAction, initialFormState);
  const v = state.values ?? {};
  const err = (field: string) => {
    const key = state.fieldErrors?.[field];
    return key ? t.errors[key] : undefined;
  };

  return (
    <form action={action} className="flex flex-col gap-6" noValidate>
      <TextField name="full_name" label={t.onboarding.nameLabel} autoComplete="name" maxLength={100} defaultValue={v.full_name} error={err("full_name")} />
      <ChoiceField
        legend={t.onboarding.languageLabel}
        name="preferred_language"
        options={LOCALES.map((l) => ({ value: l, label: t.languages[l] }))}
        defaultValue={v.preferred_language ?? locale}
        error={err("preferred_language")}
      />
      {/* The MVP starts in Bihar, so the state is filled in but can be changed. */}
      <TextField name="state" label={t.onboarding.stateLabel} maxLength={100} defaultValue={v.state ?? "Bihar"} error={err("state")} />
      <TextField name="district" label={t.onboarding.districtLabel} maxLength={100} defaultValue={v.district} error={err("district")} />
      <TextField name="village" label={t.onboarding.villageLabel} maxLength={100} defaultValue={v.village} error={err("village")} />
      <FormError message={state.formError && t.errors[state.formError]} />
      <SubmitButton label={t.onboarding.submit} pendingLabel={t.common.saving} />
    </form>
  );
}
