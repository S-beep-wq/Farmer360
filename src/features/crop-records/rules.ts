/**
 * Work and costs can be recorded for a crop in any status except COMPLETED (season reviewed and
 * closed). A cancelled crop can still have costs: money spent on a lost crop is real.
 * The database enforces the same rule.
 */
export function canRecord(status: string): boolean {
  return status !== "COMPLETED";
}
