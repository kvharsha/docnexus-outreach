import { NextResponse, type NextRequest } from "next/server";

import { listPhysicians } from "@/lib/services/physicians";
import { physicianQuerySchema } from "@/lib/validators/physicians";

export async function GET(request: NextRequest) {
  // Drop empty values (?specialty=) so a blank filter reads as "absent" rather than failing the min(1) rule.
  const params: Record<string, string> = {};
  for (const [key, value] of request.nextUrl.searchParams) {
    if (value !== "") params[key] = value;
  }

  const parsed = physicianQuerySchema.safeParse(params);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid query parameters", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const result = await listPhysicians(parsed.data);
  return NextResponse.json(result);
}
