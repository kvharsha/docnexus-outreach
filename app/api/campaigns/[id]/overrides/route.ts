import { NextResponse, type NextRequest } from "next/server";

import { CampaignNotFoundError, persistCampaignOverrides } from "@/lib/services/campaigns";
import { persistOverridesSchema } from "@/lib/validators/campaigns";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json().catch(() => null);

  const parsed = persistOverridesSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid overrides payload", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  try {
    const result = await persistCampaignOverrides(id, parsed.data);
    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    if (err instanceof CampaignNotFoundError) {
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
    }
    throw err;
  }
}
