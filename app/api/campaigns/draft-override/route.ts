import { NextResponse, type NextRequest } from "next/server";

import { AINotConfiguredError } from "@/lib/services/ai";
import { generateOverrideDraft, PhysicianNotFoundError } from "@/lib/services/campaigns";
import { draftOverrideSchema } from "@/lib/validators/campaigns";

export async function POST(request: NextRequest) {
  // Malformed JSON throws — swallow it to null so it fails validation as a 400 rather than a 500.
  const body = await request.json().catch(() => null);

  const parsed = draftOverrideSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid override request", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  try {
    const draft = await generateOverrideDraft(parsed.data);
    return NextResponse.json(draft);
  } catch (err) {
    if (err instanceof PhysicianNotFoundError) {
      return NextResponse.json({ error: "Physician not found" }, { status: 404 });
    }
    // Same split as /api/ai/draft: no key → 503, model failure → 502.
    if (err instanceof AINotConfiguredError) {
      return NextResponse.json({ error: "AI provider not configured" }, { status: 503 });
    }
    return NextResponse.json({ error: "AI request failed" }, { status: 502 });
  }
}
