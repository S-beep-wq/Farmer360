import type { Activity, Expense } from "./repository";

function text(value: number | string | null): string {
  return value === null ? "" : String(value);
}

/** A saved activity as edit-form values. */
export function activityFormValues(a: Activity): Record<string, string> {
  return {
    activity_type: a.activity_type,
    activity_date: a.activity_date,
    quantity: text(a.quantity),
    quantity_unit: text(a.quantity_unit),
    cost: text(a.cost),
    notes: text(a.notes),
  };
}

/** A saved expense as edit-form values. */
export function expenseFormValues(e: Expense): Record<string, string> {
  return {
    category: e.category,
    amount: text(e.amount),
    expense_date: e.expense_date,
    quantity: text(e.quantity),
    quantity_unit: text(e.quantity_unit),
    vendor: text(e.vendor),
    notes: text(e.notes),
  };
}
