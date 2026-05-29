import type { Physician } from "@/generated/prisma/client";

// Missing variables remain in the preview so the user can see what they forgot.
export function renderTemplate(template: string, vars: Record<string, string>) {
  return template.replace(/\{\{(\w+)\}\}/g, (full, key) => vars[key] ?? full);
}

// The chips in the editor and the substitution here have to agree on the same set of names,
// so the supported variables live in one place.
export const TEMPLATE_VARIABLES = [
  "first_name",
  "last_name",
  "doctor_name",
  "specialty",
  "affiliation",
  "city",
] as const;

// Turn a physician into the variable map renderTemplate expects. doctor_name is derived, not stored.
export function physicianToVars(physician: Physician): Record<string, string> {
  return {
    first_name: physician.firstName,
    last_name: physician.lastName,
    doctor_name: `Dr. ${physician.lastName}`,
    specialty: physician.specialty,
    affiliation: physician.affiliation,
    city: physician.city,
  };
}
