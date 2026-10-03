"use client";

import { useActionState } from "react";

import { ChoiceField, FormError, SelectField, SubmitButton, TextField } from "@/components/ui/form";
import { initialFormState, type FormState } from "@/lib/forms";
import { LOCALES, type Locale, type Messages } from "@/lib/i18n";

import { MARKET_BUYER_TYPES } from "../constants";

type Props = {
  t: Messages;
  locale: Locale;
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  submitLabel: string;
  initialValues?: Record<string, string>;
};

/** A buyer's profile, for registration and for changing it later. */
export function BuyerProfileForm({ t, locale, action: profileAction, submitLabel, initialValues = {} }: Props) {
  const [state, action] = useActionState(profileAction, initialFormState);
  const v = state.values ?? initialValues;
  const err = (field: string) => {
    const key = state.fieldErrors?.[field];
    return key ? t.errors[key] : undefined;
  };

  return (
    <form action={action} className="flex flex-col gap-6" noValidate>
      <TextField name="name" label={t.buyerOnboarding.nameLabel} autoComplete="name" maxLength={100} defaultValue={v.name} error={err("name")} />
      <TextField
        name="organization_name"
        label={t.buyerOnboarding.organizationLabel}
        optionalLabel={t.common.optional}
        maxLength={100}
        defaultValue={v.organization_name}
        error={err("organization_name")}
      />
      <SelectField
        name="buyer_type"
        label={t.buyerOnboarding.buyerTypeLabel}
        placeholder={t.common.choose}
        options={MARKET_BUYER_TYPES.map((b) => ({ value: b, label: t.buyerTypes[b] }))}
        defaultValue={v.buyer_type}
        error={err("buyer_type")}
      />
      <ChoiceField
        key={v.preferred_language ?? locale}
        legend={t.onboarding.languageLabel}
        name="preferred_language"
        options={LOCALES.map((l) => ({ value: l, label: t.languages[l] }))}
        defaultValue={v.preferred_language ?? locale}
        error={err("preferred_language")}
      />
      <TextField name="state" label={t.onboarding.stateLabel} maxLength={100} defaultValue={v.state ?? "Bihar"} error={err("state")} />
      <TextField name="district" label={t.onboarding.districtLabel} maxLength={100} defaultValue={v.district} error={err("district")} />
      <TextField name="location" label={t.buyerOnboarding.locationLabel} maxLength={100} defaultValue={v.location} error={err("location")} />
      <p className="rounded-xl border-2 border-amber-200 bg-amber-50 p-4 text-lg text-amber-900">{t.buyerOnboarding.consent}</p>
      <FormError message={state.formError && t.errors[state.formError]} />
      <SubmitButton label={submitLabel} pendingLabel={t.common.saving} />
    </form>
  );
}
