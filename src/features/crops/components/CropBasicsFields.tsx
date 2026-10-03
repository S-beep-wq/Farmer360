"use client";

import { ChoiceField, SelectField, TextField } from "@/components/ui/form";
import type { ErrorKey, Locale, Messages } from "@/lib/i18n";

import { SEASONS } from "../constants";
import { cropName } from "../format";
import type { Crop } from "../repository";

type Props = {
  t: Messages;
  locale: Locale;
  crops: Crop[];
  values: Record<string, string>;
  errors?: Record<string, ErrorKey>;
};

/** Crop, variety and season: shared by the add-crop and change-crop forms. */
export function CropBasicsFields({ t, locale, crops, values, errors }: Props) {
  const err = (field: string) => (errors?.[field] ? t.errors[errors[field]] : undefined);
  const cropOptions = crops
    .map((c) => ({ value: c.id, label: cropName(c, locale) }))
    .sort((a, b) => a.label.localeCompare(b.label, locale === "hi" ? "hi" : "en"));

  return (
    <>
      <SelectField
        name="crop_id"
        label={t.crops.cropLabel}
        placeholder={t.common.choose}
        options={cropOptions}
        defaultValue={values.crop_id}
        error={err("crop_id")}
      />
      <TextField
        name="variety_name"
        label={t.crops.varietyLabel}
        hint={t.crops.varietyHint}
        optionalLabel={t.common.optional}
        maxLength={100}
        defaultValue={values.variety_name}
        error={err("variety_name")}
      />
      <ChoiceField
        legend={t.crops.seasonLabel}
        name="season"
        options={SEASONS.map((s) => ({ value: s, label: t.seasons[s] }))}
        defaultValue={values.season}
        error={err("season")}
      />
    </>
  );
}
