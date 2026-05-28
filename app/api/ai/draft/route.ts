import { NextResponse, type NextRequest } from "next/server";

import { AINotConfiguredError, generateBrief } from "@/lib/services/ai";
import { draftRequestSchema } from "@/lib/validators/ai";

export async function POST(request: NextRequest) {
  // Malformed JSON throws — swallow it to null so it fails validation as a 400 rather than a 500.
  const body = await request.json().catch(() => null);

  const parsed = draftRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid draft payload", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  try {
    const draft = await generateBrief(parsed.data);
    return NextResponse.json(draft);
  } catch (err) {
    // No key is an operator misconfiguration (503); anything else is the model failing on us (502).
    if (err instanceof AINotConfiguredError) {
      return NextResponse.json({ error: "AI provider not configured" }, { status: 503 });
    }
    return NextResponse.json({ error: "AI request failed" }, { status: 502 });
  }
}
