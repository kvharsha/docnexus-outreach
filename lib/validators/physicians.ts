import { z } from "zod";

const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 50;
// Hard ceiling so a hand-crafted ?pageSize=99999 can't pull the whole table in one request.
const MAX_PAGE_SIZE = 100;
// Nobody's been in practice longer than this — guards against absurd cutoff years.
const MAX_YEARS_EXPERIENCE = 80;

export const physicianQuerySchema = z.object({
  specialty: z.string().trim().min(1).optional(),
  state: z.string().trim().min(1).optional(),
  affiliation: z.string().trim().min(1).optional(),
  search: z.string().trim().min(1).optional(),
  minYearsExperience: z.coerce.number().int().min(0).max(MAX_YEARS_EXPERIENCE).optional(),
  page: z.coerce.number().int().min(1).default(DEFAULT_PAGE),
  pageSize: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(DEFAULT_PAGE_SIZE),
});

export type PhysicianQuery = z.infer<typeof physicianQuerySchema>;
