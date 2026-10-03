import type { Messages } from "@/lib/i18n";

import type { CropCycleStatus } from "../constants";

const STYLES: Record<CropCycleStatus, string> = {
  PLANNED: "bg-amber-100 text-amber-900 border-amber-300",
  ACTIVE: "bg-green-100 text-green-900 border-green-300",
  HARVESTED: "bg-sky-100 text-sky-900 border-sky-300",
  COMPLETED: "bg-stone-100 text-stone-800 border-stone-300",
  CANCELLED: "bg-stone-100 text-stone-600 border-stone-300 line-through",
};

/** Status shown as text (never colour alone), so it is readable for everyone. */
export function CropStatusBadge({ status, t }: { status: CropCycleStatus; t: Messages }) {
  return (
    <span
      data-testid="crop-status"
      className={`inline-flex w-fit items-center rounded-full border-2 px-3 py-1 text-base font-semibold ${STYLES[status]}`}
    >
      {t.cropStatuses[status]}
    </span>
  );
}
