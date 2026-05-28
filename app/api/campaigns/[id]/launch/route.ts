import { NextResponse, type NextRequest } from "next/server";

import {
  CampaignNotDraftError,
  CampaignNotFoundError,
  drainPendingSends,
  launchCampaign,
} from "@/lib/services/campaigns";

export async function PATCH(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  try {
    const result = await launchCampaign(id);

    // Hand off the actual sending to a background drain so the request returns immediately.
    // setImmediate runs after the response is flushed; .catch keeps a drain failure from
    // becoming an unhandled rejection that takes down the process.
    setImmediate(() => {
      drainPendingSends(id).catch(console.error);
    });

    // 202: the queue is written and the campaign is active, but the actual sends drain afterward.
    return NextResponse.json(result, { status: 202 });
  } catch (err) {
    if (err instanceof CampaignNotFoundError) {
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
    }
    if (err instanceof CampaignNotDraftError) {
      return NextResponse.json({ error: "Campaign is not in draft status" }, { status: 409 });
    }
    throw err;
  }
}
