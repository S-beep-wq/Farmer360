"use client";

import { useId, type ReactNode } from "react";
import { useFormStatus } from "react-dom";

// Large, simple form controls for farmers using phones outdoors.
// Every control is at least 56px tall and has a visible text label.

const controlClass =
  "block w-full min-h-14 rounded-xl border-2 border-stone-300 bg-white px-4 text-lg text-stone-900 " +
  "focus:border-green-700 focus:outline-none focus:ring-4 focus:ring-green-200 " +
  "aria-[invalid=true]:border-red-600";

type FieldProps = {
  label: string;
  hint?: string;
  error?: string;
  optionalLabel?: string;
  children: (ids: { id: string; describedBy?: string; invalid: boolean }) => ReactNode;
};

export function Field({ label, hint, error, optionalLabel, children }: FieldProps) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;

  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-lg font-semibold text-stone-900">
        {label}
        {optionalLabel ? (
          <span className="ml-2 text-base font-normal text-stone-500">({optionalLabel})</span>
        ) : null}
      </label>
      {hint ? (
        <p id={hintId} className="text-base text-stone-600">
          {hint}
        </p>
      ) : null}
      {children({ id, describedBy, invalid: Boolean(error) })}
      {error ? (
        <p id={errorId} role="alert" className="text-base font-medium text-red-700">
          {error}
        </p>
      ) : null}
    </div>
  );
}

type TextFieldProps = Omit<FieldProps, "children"> & {
  name: string;
  defaultValue?: string;
  inputMode?: "text" | "numeric" | "decimal" | "tel";
  autoComplete?: string;
  maxLength?: number;
  required?: boolean;
  autoFocus?: boolean;
};

export function TextField({
  name,
  defaultValue,
  inputMode = "text",
  autoComplete,
  maxLength,
  required,
  autoFocus,
  ...field
}: TextFieldProps) {
  return (
    <Field {...field}>
      {({ id, describedBy, invalid }) => (
        <input
          id={id}
          name={name}
          type={inputMode === "tel" ? "tel" : "text"}
          inputMode={inputMode}
          autoComplete={autoComplete}
          defaultValue={defaultValue}
          maxLength={maxLength}
          required={required}
          autoFocus={autoFocus}
          aria-describedby={describedBy}
          aria-invalid={invalid}
          className={controlClass}
        />
      )}
    </Field>
  );
}

type DateFieldProps = Omit<FieldProps, "children"> & {
  name: string;
  defaultValue?: string;
  max?: string;
  min?: string;
};

/** Native date picker: familiar on phones and returns YYYY-MM-DD. */
export function DateField({ name, defaultValue, max, min, ...field }: DateFieldProps) {
  return (
    <Field {...field}>
      {({ id, describedBy, invalid }) => (
        <input
          id={id}
          name={name}
          type="date"
          defaultValue={defaultValue}
          max={max}
          min={min}
          aria-describedby={describedBy}
          aria-invalid={invalid}
          className={controlClass}
        />
      )}
    </Field>
  );
}

type SelectFieldProps = Omit<FieldProps, "children"> & {
  name: string;
  options: { value: string; label: string }[];
  placeholder?: string;
  defaultValue?: string;
};

export function SelectField({ name, options, placeholder, defaultValue, ...field }: SelectFieldProps) {
  return (
    <Field {...field}>
      {({ id, describedBy, invalid }) => (
        <select
          // React resets a form after its action runs, and a reset select falls back to the value it
          // was first rendered with. Remounting when the value changes keeps the farmer's choice.
          key={defaultValue ?? ""}
          id={id}
          name={name}
          defaultValue={defaultValue ?? ""}
          aria-describedby={describedBy}
          aria-invalid={invalid}
          className={controlClass}
        >
          {placeholder !== undefined ? <option value="">{placeholder}</option> : null}
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      )}
    </Field>
  );
}

type ChoiceFieldProps = {
  legend: string;
  name: string;
  options: { value: string; label: string }[];
  defaultValue?: string;
  error?: string;
  optionalLabel?: string;
  onChange?: (value: string) => void;
};

/** Big tappable radio tiles, for short lists like language or yes/no. */
export function ChoiceField({ legend, name, options, defaultValue, error, optionalLabel, onChange }: ChoiceFieldProps) {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-2 text-lg font-semibold text-stone-900">
        {legend}
        {optionalLabel ? (
          <span className="ml-2 text-base font-normal text-stone-500">({optionalLabel})</span>
        ) : null}
      </legend>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {options.map((o) => (
          <label
            key={o.value}
            className="flex min-h-14 cursor-pointer items-center justify-center rounded-xl border-2 border-stone-300 bg-white px-3 text-center text-lg font-medium text-stone-900 has-[:checked]:border-green-700 has-[:checked]:bg-green-50 has-[:checked]:text-green-900 has-[:focus-visible]:ring-4 has-[:focus-visible]:ring-green-200"
          >
            <input
              type="radio"
              name={name}
              value={o.value}
              defaultChecked={defaultValue === o.value}
              onChange={onChange ? () => onChange(o.value) : undefined}
              className="sr-only"
            />
            {o.label}
          </label>
        ))}
      </div>
      {error ? (
        <p role="alert" className="text-base font-medium text-red-700">
          {error}
        </p>
      ) : null}
    </fieldset>
  );
}

export function SubmitButton({ label, pendingLabel }: { label: string; pendingLabel: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="min-h-14 w-full rounded-xl bg-green-700 px-6 text-xl font-semibold text-white shadow-sm hover:bg-green-800 focus:outline-none focus:ring-4 focus:ring-green-300 disabled:opacity-70"
    >
      {pending ? pendingLabel : label}
    </button>
  );
}

export function FormError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p role="alert" className="rounded-xl border-2 border-red-200 bg-red-50 p-4 text-lg text-red-800">
      {message}
    </p>
  );
}
