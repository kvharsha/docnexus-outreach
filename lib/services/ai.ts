import { GoogleGenAI } from "@google/genai";

import type { Physician } from "@/generated/prisma/client";

// Two failure modes the callers care about: no key configured (a 503 — operator problem) vs.
// the model misbehaving (a 502 — upstream problem). Keep them separate so routes don't guess.
export class AINotConfiguredError extends Error {}
export class AIRequestError extends Error {}

const MODEL = "gemini-2.5-flash";

const SENDER = {
  name: "Jordan Mitchell",
  title: "Medical Science Liaison",
  company: "DocNexus Therapeutics",
};

// Shared across both call sites verbatim — the compliance rules are the whole point of having
// a system prompt here, so don't let the two prompts drift apart.
const SYSTEM_PROMPT = `You write outreach emails from pharmaceutical commercial teams to physicians.
Tone: professional, concise, respectful, compliant with US pharma marketing norms.

Hard rules:
- Do not promise clinical outcomes.
- Do not make superlative claims about any therapy.
- Do not invent drug names. Do not invent doctor or hospital names.
- Use the provided sender name, title, and company in the signature. Never output placeholder brackets like [Your Name] or [Company]. If a detail is missing, omit it rather than inserting a placeholder.

Output format: a single JSON object, no markdown fences, no preamble.
{"subject": "string under 80 chars", "body": "string between 90 and 160 words"}`;

type EmailDraft = { subject: string; body: string };

const CAMPAIGN_TYPE_LABELS: Record<string, string> = {
  cold_outbound: "cold outbound (first-touch, recipient has never been contacted)",
  reengagement: "re-engagement (recipient engaged before but has gone quiet)",
  conference_followup: "conference follow-up (recipient was met at a recent event)",
};

function getClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new AINotConfiguredError("GEMINI_API_KEY is not set");
  return new GoogleGenAI({ apiKey });
}

// Gemini sometimes wraps JSON in ```json fences despite responseMimeType. Strip them before parsing
// so one stray fence doesn't turn a perfectly good draft into a 502.
function parseDraft(raw: string | undefined): EmailDraft {
  if (!raw) throw new AIRequestError("AI returned an empty response");

  const cleaned = raw
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "")
    .trim();

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    throw new AIRequestError("AI returned unparseable JSON");
  }

  if (
    typeof parsed !== "object" ||
    parsed === null ||
    typeof (parsed as EmailDraft).subject !== "string" ||
    typeof (parsed as EmailDraft).body !== "string"
  ) {
    throw new AIRequestError("AI response missing subject or body");
  }

  const { subject, body } = parsed as EmailDraft;
  return { subject, body };
}

async function generate(userPrompt: string): Promise<EmailDraft> {
  const ai = getClient();

  let text: string | undefined;
  try {
    const result = await ai.models.generateContent({
      model: MODEL,
      contents: userPrompt,
      config: {
        systemInstruction: SYSTEM_PROMPT,
        // Ask for JSON directly so we rarely have to strip fences — but parseDraft still guards.
        responseMimeType: "application/json",
      },
    });
    // .text is a getter in the new SDK, not a method — calling it would throw.
    text = result.text;
  } catch (err) {
    // Re-wrap so the route only ever sees our typed errors, never a raw SDK exception.
    if (err instanceof AINotConfiguredError) throw err;
    const detail = err instanceof Error ? err.message : "unknown error";
    throw new AIRequestError(`Gemini request failed: ${detail}`);
  }

  return parseDraft(text);
}

export async function generateBrief(params: {
  campaignType: string;
  stepNumber: number;
}): Promise<EmailDraft> {
  const typeLabel = CAMPAIGN_TYPE_LABELS[params.campaignType] ?? params.campaignType;

  // Step 1 is the opener; anything later is a follow-up that should be shorter and nod to the
  // earlier message without repeating it.
  const stepGuidance =
    params.stepNumber === 1
      ? "This is the initial outreach (step 1)."
      : `This is follow-up step ${params.stepNumber}. Keep it shorter than the first message and reference that a prior message was already sent, without repeating its content.`;

  const userPrompt = `Write a generic outreach email for a ${typeLabel} campaign.
${stepGuidance}
This is a reusable draft — keep it general enough that it could later be personalized for any physician.

Sender:
- Name: ${SENDER.name}
- Title: ${SENDER.title}
- Company: ${SENDER.company}`;

  return generate(userPrompt);
}

export async function generatePersonalizedEmail(params: {
  brief: string;
  physician: Physician;
  stepNumber: number;
}): Promise<EmailDraft> {
  const { brief, physician, stepNumber } = params;
  const yearsInPractice = new Date().getFullYear() - physician.npiRegistrationYear;
  const subSpecialty = physician.subSpecialty ?? physician.specialty;

  const userPrompt = `Brief to personalize:
${brief}

Physician profile:
- Name: Dr. ${physician.firstName} ${physician.lastName}
- Specialty: ${physician.specialty}
- Sub-specialty: ${subSpecialty}
- Affiliation: ${physician.affiliation}
- City: ${physician.city}
- Years in practice: ${yearsInPractice}
- Sequence step: ${stepNumber}

Sender:
- Name: ${SENDER.name}
- Title: ${SENDER.title}
- Company: ${SENDER.company}

Rewrite the brief as a personalized email to Dr. ${physician.lastName}. Reference their ${subSpecialty} focus at ${physician.affiliation} naturally. Keep the original intent but make it feel individually written.`;

  return generate(userPrompt);
}
