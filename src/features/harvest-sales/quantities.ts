import { KG_PER_UNIT, PRODUCE_UNITS, type ProduceUnit } from "./constants";

export function isProduceUnit(value: string): value is ProduceUnit {
  return (PRODUCE_UNITS as readonly string[]).includes(value);
}

/** Converts a quantity to kilograms, rounded to grams to avoid floating-point noise. */
export function toKg(quantity: number, unit: ProduceUnit): number {
  return Math.round(quantity * KG_PER_UNIT[unit] * 1000) / 1000;
}

export function fromKg(kg: number, unit: ProduceUnit): number {
  return Math.round((kg / KG_PER_UNIT[unit]) * 1000) / 1000;
}

type SaleQuantity = { quantity: number; quantity_unit: string };

/** Kilograms sold across sales (unknown units are ignored). */
export function soldKg(sales: SaleQuantity[]): number {
  const grams = sales.reduce(
    (total, s) => total + (isProduceUnit(s.quantity_unit) ? Math.round(toKg(s.quantity, s.quantity_unit) * 1000) : 0),
    0,
  );
  return grams / 1000;
}

/** What is left to sell from a harvest, in the harvest's own unit (never below 0). */
export function remainingToSell(harvest: { quantity: number; quantity_unit: string }, sales: SaleQuantity[]): number {
  if (!isProduceUnit(harvest.quantity_unit)) return 0;
  const left = toKg(harvest.quantity, harvest.quantity_unit) - soldKg(sales);
  return Math.max(0, fromKg(left, harvest.quantity_unit));
}
