import { NextResponse, type NextRequest } from "next/server";

import { CampaignNotFoundError, getCampaignProgress } from "@/lib/services/campaigns";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  try {
    const progress = await getCampaignProgress(id);
    return NextResponse.json(progress);
  } catch (err) {
    if (err instanceof CampaignNotFoundError) {
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
    }
    throw err;
  }
}
