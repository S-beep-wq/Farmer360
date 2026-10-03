"use client";

import { useState } from "react";

import { ChoiceField, Field, SelectField } from "@/components/ui/form";
import { AREA_UNITS, IRRIGATION_TYPES, SOIL_TYPES, type AreaUnit } from "@/features/shared/land";
import type { ErrorKey, Messages } from "@/lib/i18n";

type AreaFieldProps = {
  t: Messages;
  name: string;
  label: string;
  hint?: string;
  error?: string;
  /** Controlled mode, used when the map can fill in the area. */
  value?: string;
  onValueChange?: (value: string) => void;
  unit?: AreaUnit;
  onUnitChange?: (unit: AreaUnit) => void;
  defaultValue?: string;
  defaultUnit?: string;
};

const controlClass =
  "block min-h-14 rounded-xl border-2 border-stone-300 bg-white px-4 text-lg text-stone-900 " +
  "focus:border-green-700 focus:outline-none focus:ring-4 focus:ring-green-200 aria-[invalid=true]:border-red-600";

/** Area number and unit side by side. */
export function AreaField({ t, name, label, hint, error, value, onValueChange, unit, onUnitChange, defaultValue, defaultUnit }: AreaFieldProps) {
  return (
    <Field label={label} hint={hint} error={error} optionalLabel={t.common.optional}>
      {({ id, describedBy, invalid }) => (
        <div className="flex gap-3">
          <input
            id={id}
            name={name}
            type="text"
            inputMode="decimal"
            aria-describedby={describedBy}
            aria-invalid={invalid}
            className={`${controlClass} w-full min-w-0 flex-1`}
            {...(onValueChange
              ? { value: value ?? "", onChange: (e) => onValueChange(e.target.value) }
              : { defaultValue })}
          />
          <select
            // Remount when the saved unit changes, so a form reset keeps it (see SelectField).
            key={onUnitChange ? undefined : defaultUnit}
            name="area_unit"
            aria-label={t.farms.unitLabel}
            className={`${controlClass} w-40 shrink-0 px-3`}
            {...(onUnitChange
              ? { value: unit, onChange: (e) => onUnitChange(e.target.value as AreaUnit) }
              : { defaultValue: defaultUnit || "acre" })}
          >
            {AREA_UNITS.map((u) => (
              <option key={u} value={u}>
                {t.units[u]}
              </option>
            ))}
          </select>
        </div>
      )}
    </Field>
  );
}

type IrrigationSoilFieldsProps = {
  t: Messages;
  values: Record<string, string>;
  errors?: Record<string, ErrorKey>;
};

/** Irrigation yes/no, water source (only when there is irrigation) and soil type. All optional. */
export function IrrigationSoilFields({ t, values, errors }: IrrigationSoilFieldsProps) {
  const [irrigation, setIrrigation] = useState(values.irrigation_available ?? "");
  const err = (field: string) => (errors?.[field] ? t.errors[errors[field]] : undefined);

  return (
    <>
      <ChoiceField
        legend={t.farms.irrigationQuestion}
        name="irrigation_available"
        optionalLabel={t.common.optional}
        options={[
          { value: "yes", label: t.common.yes },
          { value: "no", label: t.common.no },
          { value: "", label: t.common.notKnown },
        ]}
        defaultValue={irrigation}
        onChange={setIrrigation}
        error={err("irrigation_available")}
      />
      {irrigation === "yes" ? (
        <SelectField
          name="irrigation_type"
          label={t.farms.irrigationTypeLabel}
          optionalLabel={t.common.optional}
          placeholder={t.common.choose}
          options={IRRIGATION_TYPES.map((v) => ({ value: v, label: t.irrigationTypes[v] }))}
          defaultValue={values.irrigation_type}
          error={err("irrigation_type")}
        />
      ) : null}
      <SelectField
        name="soil_type"
        label={t.farms.soilTypeLabel}
        optionalLabel={t.common.optional}
        placeholder={t.common.choose}
        options={SOIL_TYPES.map((v) => ({ value: v, label: t.soilTypes[v] }))}
        defaultValue={values.soil_type}
        error={err("soil_type")}
      />
    </>
  );
}

type LandDetailsFieldsProps = IrrigationSoilFieldsProps & {
  areaField: string;
  areaLabel: string;
};

/** Area, irrigation and soil: the optional land details shared by the farm form. */
export function LandDetailsFields({ t, values, errors, areaField, areaLabel }: LandDetailsFieldsProps) {
  const err = (field: string) => (errors?.[field] ? t.errors[errors[field]] : undefined);
  return (
    <>
      <AreaField
        t={t}
        name={areaField}
        label={areaLabel}
        defaultValue={values[areaField]}
        defaultUnit={values.area_unit}
        error={err(areaField) ?? err("area_unit")}
      />
      <IrrigationSoilFields t={t} values={values} errors={errors} />
    </>
  );
}
