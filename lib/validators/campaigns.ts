import { z } from "zod";

export const sequenceStepSchema = z.object({
  stepNumber: z.number().int().min(1),
  delayDays: z.number().int().min(0),
  subjectTemplate: z.string().trim().min(1),
  bodyTemplate: z.string().trim().min(1),
});

export const createCampaignSchema = z
  .object({
    name: z.string().trim().min(1),
    type: z.enum(["cold_outbound", "reengagement", "conference_followup"]),
    sequences: z.array(sequenceStepSchema).min(1),
    physicianIds: z.array(z.string().min(1)).min(1),
  })
  // The initial touch goes out immediately — a non-zero delay on step 1 would mean the campaign
  // launches but sends nothing on day one. Lock it here so the API can't be talked into that.
  .refine((data) => data.sequences.some((s) => s.stepNumber === 1 && s.delayDays === 0), {
    message: "The first step (stepNumber 1) must have delayDays set to 0",
    path: ["sequences"],
  });

export type SequenceStepInput = z.infer<typeof sequenceStepSchema>;
export type CreateCampaignInput = z.infer<typeof createCampaignSchema>;

// Generate a per-physician override draft in the builder, before the campaign exists — so there's
// no campaignId yet. brief is the shared bodyTemplate the user has typed so far, if any.
export const draftOverrideSchema = z.object({
  campaignName: z.string().trim().min(1),
  campaignType: z.enum(["cold_outbound", "reengagement", "conference_followup"]),
  stepNumber: z.number().int().min(1),
  physicianId: z.string().min(1),
  brief: z.string().optional(),
  // Free-text the sender types about *this* physician ("we met at ASCO 2025…"). Shapes the draft;
  // it's an input to generation only, never stored on the final email.
  instruction: z.string().optional(),
});

export type DraftOverrideInput = z.infer<typeof draftOverrideSchema>;

const overrideEntrySchema = z.object({
  physicianId: z.string().min(1),
  stepNumber: z.number().int().min(1),
  subject: z.string().trim().min(1),
  body: z.string().trim().min(1),
});

// Persist the overrides the user accumulated in the builder, after the campaign is created.
export const persistOverridesSchema = z.object({
  overrides: z.array(overrideEntrySchema).min(1),
});

export type PersistOverridesInput = z.infer<typeof persistOverridesSchema>;
