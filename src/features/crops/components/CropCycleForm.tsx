"use client";

import { useActionState, useState } from "react";

import { ChoiceField, DateField, FormError, SelectField, SubmitButton, TextField } from "@/components/ui/form";
import { initialFormState, type FormState } from "@/lib/forms";
import type { Locale, Messages } from "@/lib/i18n";

import { SEASONS } from "../constants";
import { cropName } from "../format";
import type { Crop } from "../repository";

type Props = {
  t: Messages;
  locale: Locale;
  crops: Crop[];
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  /** Today in India, so an already-sown date cannot be picked in the future. */
  today: string;
};

/** Add a crop to a plot: crop, variety, season and (planned or actual) sowing date. */
export function CropCycleForm({ t, locale, crops, action, today }: Props) {
  const [state, formAction] = useActionState(action, initialFormState);
  const v = state.values ?? {};
  const [alreadySown, setAlreadySown] = useState(v.already_sown ?? "");
  const err = (field: string) => {
    const key = state.fieldErrors?.[field];
    return key ? t.errors[key] : undefined;
  };

  const cropOptions = crops
    .map((c) => ({ value: c.id, label: cropName(c, locale) }))
    .sort((a, b) => a.label.localeCompare(b.label, locale === "hi" ? "hi" : "en"));

  return (
    <form action={formAction} className="flex flex-col gap-6" noValidate>
      <SelectField
        name="crop_id"
        label={t.crops.cropLabel}
        placeholder={t.common.choose}
        options={cropOptions}
        defaultValue={v.crop_id}
        error={err("crop_id")}
      />
      <TextField
        name="variety_name"
        label={t.crops.varietyLabel}
        hint={t.crops.varietyHint}
        optionalLabel={t.common.optional}
        maxLength={100}
        defaultValue={v.variety_name}
        error={err("variety_name")}
      />
      <ChoiceField
        legend={t.crops.seasonLabel}
        name="season"
        options={SEASONS.map((s) => ({ value: s, label: t.seasons[s] }))}
        defaultValue={v.season}
        error={err("season")}
      />
      <ChoiceField
        legend={t.crops.alreadySownQuestion}
        name="already_sown"
        options={[
          { value: "yes", label: t.common.yes },
          { value: "no", label: t.common.no },
        ]}
        defaultValue={alreadySown}
        onChange={setAlreadySown}
        error={err("already_sown")}
      />
      {alreadySown ? (
        <DateField
          // A new key resets the field when the question changes, so its label always matches.
          key={alreadySown}
          name="sowing_date"
          label={alreadySown === "yes" ? t.crops.sowingDateLabel : t.crops.plannedSowingDateLabel}
          max={alreadySown === "yes" ? today : undefined}
          defaultValue={v.sowing_date}
          error={err("sowing_date")}
        />
      ) : null}
      <DateField
        name="expected_harvest_date"
        label={t.crops.expectedHarvestLabel}
        hint={t.crops.expectedHarvestHint}
        optionalLabel={t.common.optional}
        defaultValue={v.expected_harvest_date}
        error={err("expected_harvest_date")}
      />
      <FormError message={state.formError && t.errors[state.formError]} />
      <SubmitButton label={t.crops.create} pendingLabel={t.common.saving} />
    </form>
  );
}
