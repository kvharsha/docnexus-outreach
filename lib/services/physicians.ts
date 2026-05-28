import { prisma } from "@/lib/db";
import { Prisma, type Physician } from "@/generated/prisma/client";
import type { PhysicianQuery } from "@/lib/validators/physicians";

type PhysicianListResult = {
  data: Physician[];
  total: number;
  page: number;
  pageSize: number;
};

export async function listPhysicians(query: PhysicianQuery): Promise<PhysicianListResult> {
  const { specialty, state, affiliation, search, minYearsExperience, page, pageSize } = query;

  // Build the where clause incrementally — absent filters simply aren't added, so they don't constrain.
  // Prisma ANDs every top-level key together, which is exactly the intersection behavior the contract wants.
  const where: Prisma.PhysicianWhereInput = {};

  if (specialty) where.specialty = specialty;
  if (state) where.state = state;
  if (affiliation) where.affiliation = affiliation;

  // "10 years experience" means registered on or before (thisYear - 10). Earlier year = more senior.
  if (minYearsExperience !== undefined) {
    where.npiRegistrationYear = { lte: new Date().getFullYear() - minYearsExperience };
  }

  // Each typed token must hit first or last name, so "aisha rahman" matches across both columns.
  // SQLite's LIKE is already case-insensitive for ASCII, so we skip mode:'insensitive' (unsupported on SQLite anyway).
  if (search) {
    const tokens = search.split(/\s+/).filter(Boolean);
    where.AND = tokens.map((token) => ({
      OR: [{ firstName: { contains: token } }, { lastName: { contains: token } }],
    }));
  }

  // One round-trip for the page, one for the unfiltered-by-paging total so the UI can show "X of Y".
  const [data, total] = await Promise.all([
    prisma.physician.findMany({
      where,
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.physician.count({ where }),
  ]);

  return { data, total, page, pageSize };
}
