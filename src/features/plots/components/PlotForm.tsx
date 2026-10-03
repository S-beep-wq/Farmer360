"use client";

import { useActionState, useCallback, useState } from "react";

import { FormError, SubmitButton, TextField } from "@/components/ui/form";
import { AreaField, IrrigationSoilFields } from "@/features/shared/components/LandDetailsFields";
import { fromSquareMetres, roundArea, type AreaUnit } from "@/features/shared/land";
import { initialFormState, type FormState } from "@/lib/forms";
import { format, type Locale, type Messages } from "@/lib/i18n";

import { formatMeasuredArea } from "../format";
import type { LngLat, PlotPoint } from "../location/geo";
import { PlotLocationPicker } from "../location/PlotLocationPicker";

type Props = {
  t: Messages;
  locale: Locale;
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  initialView: { lat: number; lng: number; zoom: number };
  /** The saved plot when editing; empty when adding a plot. */
  initialValues?: Record<string, string>;
  initialLocation?: { point: PlotPoint | null; boundary: LngLat[] };
  submitLabel: string;
};

/** Used to add a plot and to change a plot's details, location and boundary. */
export function PlotForm({ t, locale, action, initialView, initialValues = {}, initialLocation, submitLabel }: Props) {
  const [state, formAction] = useActionState(action, initialFormState);
  const v = state.values ?? initialValues;
  const err = (field: string) => {
    const key = state.fieldErrors?.[field];
    return key ? t.errors[key] : undefined;
  };

  const [area, setArea] = useState(v.area ?? "");
  const [unit, setUnit] = useState<AreaUnit>((v.area_unit as AreaUnit) || "acre");
  const [boundaryAreaSqM, setBoundaryAreaSqM] = useState<number | null>(null);
  const onBoundaryAreaChange = useCallback((sqM: number | null) => setBoundaryAreaSqM(sqM), []);

  return (
    <form action={formAction} className="flex flex-col gap-6" noValidate>
      <TextField name="name" label={t.plots.nameLabel} hint={t.plots.nameHint} maxLength={100} defaultValue={v.name} error={err("name")} />

      <PlotLocationPicker
        t={t}
        initialView={initialView}
        initialPoint={initialLocation?.point}
        initialBoundary={initialLocation?.boundary}
        onBoundaryAreaChange={onBoundaryAreaChange}
        locationError={err("location") ?? err("latitude") ?? err("longitude")}
        boundaryError={err("boundary")}
      />

      {boundaryAreaSqM !== null ? (
        <div className="flex flex-col gap-3 rounded-xl border-2 border-green-200 bg-green-50 p-4">
          <p className="text-lg font-medium text-green-900" data-testid="boundary-area">
            {format(t.plots.boundaryArea, { area: formatMeasuredArea(boundaryAreaSqM, t, locale) })}
          </p>
          <button
            type="button"
            onClick={() => setArea(String(roundArea(fromSquareMetres(boundaryAreaSqM, unit), unit)))}
            className="min-h-12 rounded-xl border-2 border-green-700 bg-white px-4 text-lg font-semibold text-green-800 hover:bg-green-50"
          >
            {t.plots.useMapArea}
          </button>
        </div>
      ) : null}

      <AreaField
        t={t}
        name="area"
        label={t.plots.areaLabel}
        hint={t.plots.areaHint}
        value={area}
        onValueChange={setArea}
        unit={unit}
        onUnitChange={setUnit}
        error={err("area") ?? err("area_unit")}
      />

      <IrrigationSoilFields t={t} values={v} errors={state.fieldErrors} />

      <FormError message={state.formError && t.errors[state.formError]} />
      <SubmitButton label={submitLabel} pendingLabel={t.common.saving} />
    </form>
  );
}
