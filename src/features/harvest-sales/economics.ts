import { sumRupees } from "@/features/shared/money";

import type { Sale } from "./repository";

/**
 * A crop's result so far (USER_WORKFLOWS.md section 15):
 *   gross revenue − production costs − selling/transport costs = net result.
 * Based only on what the farmer recorded; it is not a forecast.
 */
export function cropResult(productionCosts: number, sales: Pick<Sale, "gross_amount" | "transport_cost" | "other_cost" | "payment_status">[]) {
  const revenue = sumRupees(sales.map((s) => s.gross_amount));
  const sellingCosts = sumRupees(sales.flatMap((s) => [s.transport_cost, s.other_cost]));
  const net = sumRupees([revenue, -productionCosts, -sellingCosts]);
  return {
    revenue,
    productionCosts,
    sellingCosts,
    net,
    /** True when some buyers have not paid in full yet: the money is recorded, not received. */
    paymentPending: sales.some((s) => s.payment_status !== "PAID"),
  };
}
