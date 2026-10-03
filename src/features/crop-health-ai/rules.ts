import type { CropHealthResult, Level } from "./schema";

// Rules applied to every AI answer before it is stored or shown (USER_WORKFLOWS.md section 18:
// "never hide uncertainty"). They only make an answer more cautious, never less.

export const MAX_ANALYSES_PER_OBSERVATION = 3;
const MAX_CAUSES = 3;
const MAX_STEPS = 4;
const MAX_INFO = 3;
const MAX_TEXT = 500;

const clip = (s: string) => (s.length > MAX_TEXT ? `${s.slice(0, MAX_TEXT - 1)}…` : s).trim();
const clipAll = (list: string[], max: number) => list.map(clip).filter(Boolean).slice(0, max);

/**
 * Makes an answer safe to show:
 * - an unusable photo has no causes and LOW confidence;
 * - LOW confidence always comes with something to do about it (more information or an expert);
 * - the farmer's own "serious problem" always leads to an expert, whatever the AI says.
 */
export function normalizeResult(raw: CropHealthResult, farmerStatus: string): CropHealthResult {
  const r: CropHealthResult = {
    image_usable: raw.image_usable,
    summary: clip(raw.summary),
    possible_causes: raw.possible_causes.slice(0, MAX_CAUSES).map((c) => ({ ...c, name: clip(c.name), why: clip(c.why) })),
    confidence: raw.confidence,
    next_steps: clipAll(raw.next_steps, MAX_STEPS),
    see_expert: raw.see_expert,
    expert_reason: raw.expert_reason ? clip(raw.expert_reason) : null,
    more_information_needed: clipAll(raw.more_information_needed, MAX_INFO),
  };
  if (!r.image_usable) {
    r.possible_causes = [];
    r.confidence = "LOW";
  }
  if (r.confidence === "LOW" && r.more_information_needed.length === 0) r.see_expert = true;
  if (farmerStatus === "SERIOUS") r.see_expert = true;
  return r;
}

/** Whether the farmer can ask for another analysis of this observation. */
export function canRequestAnalysis(opts: { enabled: boolean; hasPhoto: boolean; analyses: number }): boolean {
  return opts.enabled && opts.hasPhoto && opts.analyses < MAX_ANALYSES_PER_OBSERVATION;
}

export function isLevel(value: string): value is Level {
  return value === "LOW" || value === "MEDIUM" || value === "HIGH";
}
