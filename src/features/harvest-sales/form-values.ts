import type { Harvest, Sale } from "./repository";

function text(value: number | string | null): string {
  return value === null ? "" : String(value);
}

export function harvestFormValues(h: Harvest): Record<string, string> {
  return {
    harvest_date: h.harvest_date,
    quantity: text(h.quantity),
    quantity_unit: h.quantity_unit,
    quality_grade: text(h.quality_grade),
    notes: text(h.notes),
  };
}

export function saleFormValues(s: Sale): Record<string, string> {
  return {
    buyer_type: s.buyer_type,
    buyer_name: text(s.buyer_name),
    sale_date: s.sale_date,
    quantity: text(s.quantity),
    quantity_unit: s.quantity_unit,
    price_per_unit: text(s.price_per_unit),
    // 0 is the database default for "no cost"; show it as an empty optional field.
    transport_cost: s.transport_cost ? String(s.transport_cost) : "",
    other_cost: s.other_cost ? String(s.other_cost) : "",
    payment_status: s.payment_status,
    notes: text(s.notes),
  };
}
