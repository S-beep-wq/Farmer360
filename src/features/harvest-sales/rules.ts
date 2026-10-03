/** New harvests: only for a crop that has been sown and is in the field or harvested (the database checks too). */
export function canAddHarvest(status: string): boolean {
  return status === "ACTIVE" || status === "HARVESTED";
}

/** Existing harvests and their sales can be changed until the season is completed. */
export function canChangeHarvests(status: string): boolean {
  return status !== "COMPLETED";
}
