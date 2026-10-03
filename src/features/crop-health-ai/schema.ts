import { z } from "zod";

// The structured answer the AI must return (PRODUCT_SPEC.md section 16, crop-health assistance):
// possible observations with how likely each is, confidence, next actions, when to see an expert,
// and what would make it more sure. Limits on list lengths are applied in rules.ts.

export const LEVELS = ["LOW", "MEDIUM", "HIGH"] as const;
export type Level = (typeof LEVELS)[number];

export const cropHealthResultSchema = z.object({
  image_usable: z.boolean().describe("False when the photo does not show the crop clearly enough to say anything useful."),
  summary: z.string().describe("One or two short, plain sentences for the farmer."),
  possible_causes: z
    .array(
      z.object({
        name: z.string().describe("Short name of the possible problem, or 'Looks healthy'."),
        why: z.string().describe("What in the photo or note points to it."),
        likelihood: z.enum(LEVELS),
      }),
    )
    .describe("Most likely first. Include alternative explanations where relevant. Empty when the image is not usable."),
  confidence: z.enum(LEVELS).describe("How sure you are overall, from a photo alone."),
  next_steps: z.array(z.string()).describe("Simple, safe things the farmer can check or do. No chemical names or doses."),
  see_expert: z.boolean().describe("True when an agriculture expert should look at the crop."),
  expert_reason: z.string().nullable(),
  more_information_needed: z.array(z.string()).describe("What would make the answer more certain, e.g. a closer photo of one leaf."),
});

export type CropHealthResult = z.infer<typeof cropHealthResultSchema>;
