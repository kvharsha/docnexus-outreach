import { z } from "zod";

export const draftRequestSchema = z.object({
  campaignType: z.enum(["cold_outbound", "reengagement", "conference_followup"]),
  stepNumber: z.number().int().min(1),
});

export type DraftRequestInput = z.infer<typeof draftRequestSchema>;
