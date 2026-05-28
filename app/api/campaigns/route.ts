import { NextResponse, type NextRequest } from "next/server";

import { createCampaign, listCampaigns } from "@/lib/services/campaigns";
import { createCampaignSchema } from "@/lib/validators/campaigns";

export async function GET() {
  const campaigns = await listCampaigns();
  return NextResponse.json(campaigns);
}

export async function POST(request: NextRequest) {
  // Malformed JSON throws — swallow it to null so it fails validation as a 400 rather than a 500.
  const body = await request.json().catch(() => null);

  const parsed = createCampaignSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid campaign payload", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const campaign = await createCampaign(parsed.data);
  return NextResponse.json(campaign, { status: 201 });
}
