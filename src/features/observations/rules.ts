/** New observations: only for a crop that is in the field (the database checks too). */
export function canAddObservation(status: string): boolean {
  return status === "ACTIVE";
}

/** Observations made by mistake can be removed until the season is completed. */
export function canRemoveObservation(status: string): boolean {
  return status !== "COMPLETED";
}
