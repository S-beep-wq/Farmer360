"use server";

import { randomUUID } from "node:crypto";

import { redirect } from "next/navigation";

import { todayInIndia } from "@/features/crops/dates";
import { getCropCycle } from "@/features/crops/repository";
import { isId } from "@/features/farms/schema";
import { getPlot } from "@/features/plots/repository";
import { requireFarmer } from "@/lib/auth";
import { fieldErrorsFrom, formValues, type FormState } from "@/lib/forms";
import { createClient } from "@/lib/supabase/server";

import { checkPhoto, safeFileName, type PhotoType } from "./photo";
import { insertObservation, removeObservation, savePhoto } from "./repository";
import { canAddObservation, canRemoveObservation } from "./rules";
import { observationSchema } from "./schema";

// Crop observations with an optional photo (USER_WORKFLOWS.md section 8). The original photo is
// kept as uploaded (after the browser made it smaller); nothing here analyses or changes it.

type CropIds = { farmId: string; plotId: string; cycleId: string };

async function loadCrop(ids: CropIds) {
  const farmer = await requireFarmer();
  if (!isId(ids.farmId) || !isId(ids.plotId) || !isId(ids.cycleId)) return null;
  const supabase = await createClient();
  const [plot, cycle] = await Promise.all([getPlot(supabase, ids.farmId, ids.plotId), getCropCycle(supabase, ids.plotId, ids.cycleId)]);
  return plot && cycle ? { farmer, supabase, cycle } : null;
}

function cropPage(ids: CropIds) {
  return `/farms/${ids.farmId}/plots/${ids.plotId}/crops/${ids.cycleId}`;
}

export async function createObservationAction(ids: CropIds, _prev: FormState, formData: FormData): Promise<FormState> {
  const values = formValues(formData);
  const crop = await loadCrop(ids);
  if (!crop || !canAddObservation(crop.cycle.status) || !crop.cycle.actual_sowing_date) {
    return { formError: "generic", values };
  }

  const parsed = observationSchema(todayInIndia(), crop.cycle.actual_sowing_date).safeParse(values);
  if (!parsed.success) return { fieldErrors: fieldErrorsFrom(parsed.error), values };

  const file = formData.get("photo");
  const photo = file instanceof File && file.size > 0 ? file : null;
  if (!photo && !parsed.data.farmer_notes) return { formError: "photoOrNoteRequired", values };

  // Check the photo before saving anything.
  let checked: { bytes: Uint8Array; type: PhotoType } | null = null;
  if (photo) {
    const bytes = new Uint8Array(await photo.arrayBuffer());
    const result = checkPhoto(bytes);
    if ("error" in result) return { fieldErrors: { photo: result.error }, values };
    checked = { bytes, type: result.type };
  }

  const { id, error } = await insertObservation(crop.supabase, ids.cycleId, parsed.data);
  if (error || !id) {
    console.error("createObservation failed", { farmerId: crop.farmer.id, code: error?.code });
    return { formError: "generic", values };
  }

  if (photo && checked) {
    const path = `${crop.farmer.id}/${ids.farmId}/${ids.plotId}/${ids.cycleId}/${id}/${randomUUID()}.${checked.type.ext}`;
    const saved = await savePhoto(crop.supabase, id, path, checked.bytes, checked.type, safeFileName(photo.name, checked.type.ext));
    if (saved.error) {
      console.error("savePhoto failed", { farmerId: crop.farmer.id, message: saved.error.message });
      // Do not leave a half-saved observation behind.
      await removeObservation(crop.supabase, ids.cycleId, id);
      return { formError: "photoUploadFailed", values };
    }
  }

  redirect(cropPage(ids));
}

export async function removeObservationAction(ids: CropIds & { observationId: string }): Promise<FormState> {
  const crop = await loadCrop(ids);
  if (!crop || !canRemoveObservation(crop.cycle.status) || !isId(ids.observationId)) return { formError: "generic" };
  const { updated, error } = await removeObservation(crop.supabase, ids.cycleId, ids.observationId);
  if (error || !updated) {
    console.error("removeObservation failed", { farmerId: crop.farmer.id, code: error?.code });
    return { formError: "generic" };
  }
  redirect(`${cropPage(ids)}/observations`);
}
