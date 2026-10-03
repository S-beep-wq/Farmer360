import type { Messages } from "@/lib/i18n";

import type { DemandState } from "./rules";

export function demandStateLabel(state: DemandState, t: Messages): string {
  return { OPEN: t.market.open, DATE_PASSED: t.market.datePassed, FULFILLED: t.market.fulfilled, CANCELLED: t.market.cancelled }[state];
}

export function buyerTypeLabel(type: string, t: Messages): string {
  return type in t.buyerTypes ? t.buyerTypes[type as keyof Messages["buyerTypes"]] : type;
}

/** "tel:" link for an Indian mobile number stored in E.164. */
export function telHref(phone: string): string {
  return `tel:${phone.replace(/[^+\d]/g, "")}`;
}
