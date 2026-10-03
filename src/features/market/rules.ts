/** What a farmer or buyer sees about a demand's state. "DATE_PASSED" is open demand whose date has gone. */
export type DemandState = "OPEN" | "DATE_PASSED" | "FULFILLED" | "CANCELLED";

export function demandState(demand: { demand_status: string; required_date: string }, today: string): DemandState {
  if (demand.demand_status === "FULFILLED" || demand.demand_status === "CANCELLED") return demand.demand_status;
  if (demand.demand_status === "ACTIVE" && demand.required_date >= today) return "OPEN";
  return "DATE_PASSED";
}

/** Farmers can respond, and buyers can close, only open demand. */
export function isDemandOpen(demand: { demand_status: string; required_date: string }, today: string): boolean {
  return demandState(demand, today) === "OPEN";
}

/** Escapes a value for an exact, case-insensitive ILIKE match. */
export function ilikeExact(value: string): string {
  return value.trim().replace(/[\\%_]/g, (c) => `\\${c}`);
}
