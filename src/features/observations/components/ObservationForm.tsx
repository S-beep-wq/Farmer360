"use client";

import { useActionState, useEffect, useId, useRef, useState } from "react";

import { ChoiceField, DateField, FormError, SubmitButton, TextAreaField } from "@/components/ui/form";
import { initialFormState, type FormState } from "@/lib/forms";
import type { Messages } from "@/lib/i18n";

import { HEALTH_STATUSES } from "../constants";
import { shrinkPhoto } from "../shrink-photo";

type Props = {
  t: Messages;
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  today: string;
  sowingDate: string;
};

/** Add a crop observation: a photo and/or a note, and how the crop looks (USER_WORKFLOWS.md section 8). */
export function ObservationForm({ t, action, today, sowingDate }: Props) {
  const [state, formAction] = useActionState(action, initialFormState);
  const v = state.values ?? { observation_date: today };
  const [health, setHealth] = useState(v.health_status ?? "");
  const [preparing, setPreparing] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  // The prepared (smaller) photo. Kept here because React clears file inputs when a form is reset
  // after an error; it is added to the form data on every submit instead.
  const [photo, setPhoto] = useState<File | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const photoId = useId();
  const err = (field: string) => {
    const key = state.fieldErrors?.[field];
    return key ? t.errors[key] : undefined;
  };

  useEffect(() => () => {
    if (preview) URL.revokeObjectURL(preview);
  }, [preview]);

  async function onPhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.currentTarget.files?.[0];
    if (!file) return;
    setPreparing(true);
    try {
      const small = await shrinkPhoto(file);
      setPhoto(small);
      setPreview(URL.createObjectURL(small));
    } finally {
      setPreparing(false);
    }
  }

  function removePhoto() {
    setPhoto(null);
    setPreview(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  function submit(formData: FormData) {
    formData.delete("photo");
    if (photo) formData.set("photo", photo);
    formAction(formData);
  }

  return (
    <form action={submit} className="flex flex-col gap-6" noValidate>
      <div className="flex flex-col gap-2">
        <label htmlFor={photoId} className="text-lg font-semibold text-stone-900">
          {t.observations.photoLabel}
          <span className="ml-2 text-base font-normal text-stone-500">({t.common.optional})</span>
        </label>
        <p className="text-base text-stone-600">{t.observations.photoHint}</p>
        <input
          ref={inputRef}
          id={photoId}
          type="file"
          accept="image/*"
          onChange={onPhotoChange}
          aria-invalid={Boolean(err("photo"))}
          className="block w-full rounded-xl border-2 border-dashed border-stone-300 bg-white p-4 text-lg file:mr-4 file:min-h-12 file:rounded-lg file:border-0 file:bg-green-700 file:px-4 file:text-lg file:font-semibold file:text-white"
        />
        {preparing ? <p className="text-base text-stone-700">{t.observations.photoPreparing}</p> : null}
        {preview ? (
          // A local preview (blob: URL) of the photo about to be uploaded.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt="" className="max-h-72 w-full rounded-xl object-cover" data-testid="photo-preview" />
        ) : null}
        {photo ? (
          <button
            type="button"
            onClick={removePhoto}
            className="min-h-12 w-fit self-start rounded-lg px-1 text-lg font-medium text-red-700 underline underline-offset-4"
          >
            {t.observations.removePhoto}
          </button>
        ) : null}
        {err("photo") ? (
          <p role="alert" className="text-base font-medium text-red-700">
            {err("photo")}
          </p>
        ) : null}
      </div>

      <ChoiceField
        legend={t.observations.healthLabel}
        name="health_status"
        options={HEALTH_STATUSES.map((h) => ({ value: h, label: t.healthStatuses[h] }))}
        defaultValue={health}
        onChange={setHealth}
        error={err("health_status")}
      />
      {health === "SERIOUS" ? <p className="rounded-xl bg-amber-50 p-4 text-base text-amber-950">{t.observations.expertHint}</p> : null}

      <TextAreaField
        name="farmer_notes"
        label={t.observations.notesLabel}
        hint={t.observations.notesHint}
        optionalLabel={t.common.optional}
        maxLength={1000}
        defaultValue={v.farmer_notes}
        error={err("farmer_notes")}
      />
      <DateField
        name="observation_date"
        label={t.observations.dateLabel}
        min={sowingDate}
        max={today}
        defaultValue={v.observation_date}
        error={err("observation_date")}
      />
      <FormError message={state.formError && t.errors[state.formError]} />
      <SubmitButton label={t.observations.save} pendingLabel={t.common.saving} disabled={preparing} />
    </form>
  );
}
