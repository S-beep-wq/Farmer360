"use client";

import Link from "next/link";
import { useActionState } from "react";

import { DateField, FormError, SubmitButton } from "@/components/ui/form";
import { initialFormState, type FormState } from "@/lib/forms";
import type { Locale, Messages } from "@/lib/i18n";

import type { Crop } from "../repository";

import { CropBasicsFields } from "./CropBasicsFields";

type FormAction = (prev: FormState, formData: FormData) => Promise<FormState>;

function useForm(t: Messages, action: FormAction) {
  const [state, formAction] = useActionState(action, initialFormState);
  const err = (field: string) => {
    const key = state.fieldErrors?.[field];
    return key ? t.errors[key] : undefined;
  };
  return { state, formAction, err };
}

/** PLANNED → ACTIVE: one date (default today) and the expected harvest, which may need adjusting. */
export function RecordSowingForm(props: { t: Messages; action: FormAction; today: string; expectedHarvestDate: string | null }) {
  const { t, today } = props;
  const { state, formAction, err } = useForm(t, props.action);
  const v = state.values ?? { actual_sowing_date: today, expected_harvest_date: props.expectedHarvestDate ?? "" };
  return (
    <form action={formAction} className="flex flex-col gap-6" noValidate>
      <DateField name="actual_sowing_date" label={t.crops.sowingDateLabel} max={today} defaultValue={v.actual_sowing_date} error={err("actual_sowing_date")} />
      <DateField
        name="expected_harvest_date"
        label={t.crops.expectedHarvestLabel}
        hint={t.crops.expectedHarvestHint}
        optionalLabel={t.common.optional}
        defaultValue={v.expected_harvest_date}
        error={err("expected_harvest_date")}
      />
      <FormError message={state.formError && t.errors[state.formError]} />
      <SubmitButton label={t.crops.recordSowing} pendingLabel={t.common.saving} />
    </form>
  );
}

/** ACTIVE → HARVESTED: the date the harvest finished (default today). */
export function RecordHarvestForm(props: { t: Messages; action: FormAction; today: string; sowingDate: string }) {
  const { t, today } = props;
  const { state, formAction, err } = useForm(t, props.action);
  const v = state.values ?? { actual_harvest_date: today };
  return (
    <form action={formAction} className="flex flex-col gap-6" noValidate>
      <DateField
        name="actual_harvest_date"
        label={t.crops.harvestDateLabel}
        hint={t.crops.harvestHint}
        min={props.sowingDate}
        max={today}
        defaultValue={v.actual_harvest_date}
        error={err("actual_harvest_date")}
      />
      <FormError message={state.formError && t.errors[state.formError]} />
      <SubmitButton label={t.crops.recordHarvest} pendingLabel={t.common.saving} />
    </form>
  );
}

/** PLANNED/ACTIVE → CANCELLED, after a clear confirmation. */
export function CancelCropForm(props: { t: Messages; action: FormAction; backHref: string }) {
  const { t } = props;
  const { state, formAction } = useForm(t, props.action);
  return (
    <form action={formAction} className="flex flex-col gap-4">
      <p className="text-lg text-stone-800">{t.crops.cancelExplain}</p>
      <FormError message={state.formError && t.errors[state.formError]} />
      <button
        type="submit"
        className="min-h-14 w-full rounded-xl bg-red-700 px-6 text-xl font-semibold text-white hover:bg-red-800 focus:outline-none focus:ring-4 focus:ring-red-300"
      >
        {t.crops.cancelConfirm}
      </button>
      <Link
        href={props.backHref}
        className="flex min-h-14 w-full items-center justify-center rounded-xl border-2 border-green-700 bg-white px-6 text-xl font-semibold text-green-800 hover:bg-green-50 focus:outline-none focus:ring-4 focus:ring-green-300"
      >
        {t.crops.cancelKeep}
      </Link>
    </form>
  );
}

type EditProps = {
  t: Messages;
  locale: Locale;
  crops: Crop[];
  action: FormAction;
  today: string;
  status: "PLANNED" | "ACTIVE" | "HARVESTED";
  initialValues: Record<string, string>;
};

/** Change a crop's details; only the dates that apply to its status are shown. */
export function CropCycleEditForm({ t, locale, crops, action, today, status, initialValues }: EditProps) {
  const { state, formAction, err } = useForm(t, action);
  const v = state.values ?? initialValues;
  return (
    <form action={formAction} className="flex flex-col gap-6" noValidate>
      <CropBasicsFields t={t} locale={locale} crops={crops} values={v} errors={state.fieldErrors} />
      {status === "PLANNED" ? (
        <DateField name="planned_sowing_date" label={t.crops.plannedSowingDateLabel} defaultValue={v.planned_sowing_date} error={err("planned_sowing_date")} />
      ) : (
        <DateField name="actual_sowing_date" label={t.crops.sowingDateLabel} max={today} defaultValue={v.actual_sowing_date} error={err("actual_sowing_date")} />
      )}
      {status === "HARVESTED" ? (
        <DateField name="actual_harvest_date" label={t.crops.harvestDateLabel} max={today} defaultValue={v.actual_harvest_date} error={err("actual_harvest_date")} />
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
      <SubmitButton label={t.common.saveChanges} pendingLabel={t.common.saving} />
    </form>
  );
}
