import { daysInField, seasonSummary } from "@/features/season-review/summary";
import type { CropTotals } from "@/features/season-review/repository";

import type { ReferenceEstimate } from "./reference";

// Crop planning (USER_WORKFLOWS.md section 5): compares candidate crops for one plot and season
// and returns structured results (SYSTEM_ARCHITECTURE.md section 14). Everything here is a
// FACT from the farmer's own records or from what is in the app today (open buyer demand,
// official scheme and insurance information). It makes no yield, price or profit estimate.

export type PastSeason = {
  crop_id: string;
  season: string;
  plot_id: string;
  /** The plot's size in acres, when known. */
  acres: number | null;
  sowingDate: string | null;
  harvestDate: string | null;
  totals: CropTotals;
};

export type Range = { min: number; max: number; average: number; count: number };

export type CropHistory = {
  /** Closed seasons of this crop in the chosen season, on any of the farmer's plots. */
  seasons: number;
  onThisPlot: number;
  /** Per acre, from seasons whose plot size is known. */
  netPerAcre: Range | null;
  costPerAcre: Range | null;
  revenuePerAcre: Range | null;
  harvestKgPerAcre: Range | null;
  daysInField: Range | null;
};

export type Candidate = {
  crop_id: string;
  history: CropHistory;
  /** Typical ranges from a reference source for this crop, season and place (estimates, not facts). */
  reference: ReferenceEstimate | null;
  /** This crop was the last one grown on this plot. */
  grownHereLast: boolean;
  openDemand: number;
  schemes: number;
  insurance: number;
};

export type PlanInput = {
  season: string;
  plotId: string;
  cropIds: string[];
  pastSeasons: PastSeason[];
  lastCropOnPlot: string | null;
  openDemand: Map<string, number>;
  schemes: Map<string, number>;
  insurance: Map<string, number>;
  /** Reference estimates by crop, for this season and place. */
  references?: Map<string, ReferenceEstimate>;
};

export function range(values: number[]): Range | null {
  if (values.length === 0) return null;
  const sum = values.reduce((a, b) => a + b, 0);
  return { min: Math.min(...values), max: Math.max(...values), average: Math.round((sum / values.length) * 100) / 100, count: values.length };
}

const perAcre = (value: number, acres: number) => Math.round((value / acres) * 100) / 100;

export function cropHistory(pastSeasons: PastSeason[], plotId: string): CropHistory {
  const sized = pastSeasons.filter((s): s is PastSeason & { acres: number } => s.acres !== null && s.acres > 0);
  const summaries = sized.map((s) => ({ s, sum: seasonSummary(s.totals, s.acres) }));
  const days = pastSeasons.map((s) => daysInField(s.sowingDate, s.harvestDate)).filter((d): d is number => d !== null);
  return {
    seasons: pastSeasons.length,
    onThisPlot: pastSeasons.filter((s) => s.plot_id === plotId).length,
    netPerAcre: range(summaries.map(({ s, sum }) => perAcre(sum.net, s.acres))),
    costPerAcre: range(summaries.map(({ s, sum }) => perAcre(sum.totalCost, s.acres))),
    revenuePerAcre: range(summaries.map(({ s, sum }) => perAcre(sum.revenue, s.acres))),
    harvestKgPerAcre: range(summaries.filter(({ sum }) => sum.harvestedKg > 0).map(({ s, sum }) => perAcre(sum.harvestedKg, s.acres))),
    daysInField: range(days),
  };
}

/**
 * Every catalog crop as a candidate. Crops the farmer has closed seasons of (in this season) come
 * first, ordered by their own average result per acre; then the rest: crops with reference data
 * for this season (usually grown then) before the others, in catalog order. Estimates never
 * change the order of the farmer's own results.
 */
export function planCandidates(input: PlanInput): { withHistory: Candidate[]; others: Candidate[] } {
  const inSeason = input.pastSeasons.filter((s) => s.season === input.season);
  const candidates = input.cropIds.map((crop_id) => ({
    crop_id,
    history: cropHistory(
      inSeason.filter((s) => s.crop_id === crop_id),
      input.plotId,
    ),
    reference: input.references?.get(crop_id) ?? null,
    grownHereLast: input.lastCropOnPlot === crop_id,
    openDemand: input.openDemand.get(crop_id) ?? 0,
    schemes: input.schemes.get(crop_id) ?? 0,
    insurance: input.insurance.get(crop_id) ?? 0,
  }));
  const net = (c: Candidate) => c.history.netPerAcre?.average ?? Number.NEGATIVE_INFINITY;
  return {
    withHistory: candidates.filter((c) => c.history.seasons > 0).sort((a, b) => net(b) - net(a)),
    others: candidates.filter((c) => c.history.seasons === 0).sort((a, b) => Number(b.reference !== null) - Number(a.reference !== null)),
  };
}
