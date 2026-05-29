// A per-physician, per-step override the user wrote in the builder. Kept in memory until the
// campaign is created, then persisted via POST /api/campaigns/:id/overrides.
export type OverrideDraft = { subject: string; body: string };

// physicianId -> stepNumber -> draft. Sparse: most physicians have no entry and fall back to the
// shared template.
export type OverridesMap = Record<string, Record<number, OverrideDraft>>;
