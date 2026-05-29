import { GoogleGenAI } from "@google/genai";
import OpenAI from "openai";
import Groq from "groq-sdk";

import type { Physician } from "@/generated/prisma/client";

// Two failure modes the callers care about: no key configured (a 503 — operator problem) vs.
// the model misbehaving (a 502 — upstream problem). Keep them separate so routes don't guess.
export class AINotConfiguredError extends Error {}
export class AIRequestError extends Error {}

const GEMINI_MODEL = "gemini-2.5-flash";
const OPENAI_MODEL = "gpt-4o-mini";

const SENDER = {
  name: "Harshaa KV",
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
- Use the provided sender name, title, and company in the signature. NEVER output bracketed placeholders of any kind — not [Your Name], [Company], [Conference Name], [Date], [Product], [Topic], or anything in square or curly brackets. If a detail isn't provided, rephrase so it isn't needed; do not leave a blank to fill in.

Output format: a single JSON object, no markdown fences, no preamble.
{"subject": "string under 80 chars", "body": "string between 90 and 160 words"}`;

type EmailDraft = { subject: string; body: string };

const CAMPAIGN_TYPE_LABELS: Record<string, string> = {
  cold_outbound: "cold outbound (first-touch, recipient has never been contacted)",
  reengagement: "re-engagement (recipient engaged before but has gone quiet)",
  conference_followup: "conference follow-up (recipient was met at a recent event)",
};

// One round-trip to Gemini. Throws on any SDK/parse error so callLLM can decide whether to fall back.
async function callGemini(apiKey: string, systemPrompt: string, userPrompt: string): Promise<EmailDraft> {
  const ai = new GoogleGenAI({ apiKey });
  const result = await ai.models.generateContent({
    model: GEMINI_MODEL,
    contents: userPrompt,
    config: {
      systemInstruction: systemPrompt,
      // Ask for JSON directly so we rarely have to strip fences — but parseDraft still guards.
      responseMimeType: "application/json",
    },
  });
  // .text is a getter in the new SDK, not a method — calling it would throw.
  return parseDraft(result.text);
}

// Same contract via OpenAI's chat API. response_format json_object makes the model emit a bare JSON
// object, which parseDraft then validates exactly like the Gemini output.
async function callOpenAI(apiKey: string, systemPrompt: string, userPrompt: string): Promise<EmailDraft> {
  const client = new OpenAI({ apiKey });
  const completion = await client.chat.completions.create({
    model: OPENAI_MODEL,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
  });
  // content is string | null; parseDraft wants string | undefined.
  return parseDraft(completion.choices[0]?.message?.content ?? undefined);
}

async function callGroq(groqKey: string, systemPrompt: string, userPrompt: string): Promise<EmailDraft> {
  const client = new Groq({ apiKey: groqKey });
  const completion = await client.chat.completions.create({
    model: "llama-3.1-8b-instant",
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
  });
  // content is string | null; parseDraft wants string | undefined.
  return parseDraft(completion.choices[0]?.message?.content ?? undefined);
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

// Single place the provider chain lives. Gemini's free tier is rate-limited and flaky — exactly the
// kind of thing that dies mid-demo or mid-interview — so if it fails and an OpenAI key is present we
// quietly fall back to gpt-4o-mini rather than showing the user an error. Both generateBrief and
// generatePersonalizedEmail go through here, so the fallback is defined once.
async function callLLM(systemPrompt: string, userPrompt: string): Promise<EmailDraft> {
  const geminiKey = process.env.GEMINI_API_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;
  const groqKey = process.env.GROQ_API_KEY;

  // Neither provider configured → operator problem, surfaced as a 503 by the route.
  if (!geminiKey && !openaiKey && !groqKey) {
    throw new AINotConfiguredError("No AI provider configured (set GEMINI_API_KEY or OPENAI_API_KEY or GROQ_API_KEY)");
  }

  // Primary: Gemini. If it works, we're done. If it throws and there's no fallback key, surface it.
  if (geminiKey) {
    try {
      return await callGemini(geminiKey, systemPrompt, userPrompt);
    } catch (err) {
      if (!openaiKey && !groqKey) {
        const detail = err instanceof Error ? err.message : "unknown error";
        throw new AIRequestError(`Gemini request failed: ${detail}`);
      }
      // Otherwise drop through to the OpenAI fallback below.
    }
  }

  // Fallback: OpenAI. Reached when Gemini failed (and we have a key) or no Gemini key was set at all.
  if (openaiKey) {
    try {
      return await callOpenAI(openaiKey, systemPrompt, userPrompt);
    } catch (err) {
      if (!groqKey) {
        const detail = err instanceof Error ? err.message : "unknown error";
        throw new AIRequestError(`OpenAI request failed: ${detail}`);
      }
      // Otherwise drop through to the Groq fallback below.
    }
  }
  // Fallback: Groq. Reached when OpenAI failed (and we have a key) or no OpenAI key was set at all.
  try {
    return await callGroq(groqKey!, systemPrompt, userPrompt);
  } catch (err) {
    const detail = err instanceof Error ? err.message : "unknown error";
    throw new AIRequestError(`AI request failed (Groq unavailable): ${detail}`);
  }
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

  return callLLM(SYSTEM_PROMPT, userPrompt);
}

export async function generatePersonalizedEmail(params: {
  physician: Physician;
  stepNumber: number;
  // Optional: the shared bodyTemplate to rewrite. If omitted, the model writes from scratch using
  // the campaign context + physician profile below.
  brief?: string;
  // Optional campaign context — useful when there's no brief to anchor the email's intent.
  campaignName?: string;
  campaignType?: string;
  // Optional sender-supplied context about this specific physician. When present it takes priority
  // for shaping the content — it's the whole reason a per-physician override differs from the shared draft.
  instruction?: string;
}): Promise<EmailDraft> {
  const { brief, physician, stepNumber, campaignName, campaignType, instruction } = params;
  const yearsInPractice = new Date().getFullYear() - physician.npiRegistrationYear;
  const subSpecialty = physician.subSpecialty ?? physician.specialty;
  const typeLabel = campaignType ? (CAMPAIGN_TYPE_LABELS[campaignType] ?? campaignType) : undefined;

  // Anchor the email's intent on the brief when we have one; otherwise lean on campaign context so
  // the model still knows what the outreach is for.
  const intent = brief
    ? `Brief to personalize:\n${brief}`
    : `No draft was provided — write this email from scratch using the campaign context and physician profile below.`;

  const campaignContext = [
    campaignName ? `- Campaign: ${campaignName}` : null,
    typeLabel ? `- Campaign type: ${typeLabel}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  // The instruction shapes the content most strongly, so give it its own labelled block.
  const instructionBlock = instruction
    ? `\nThe sender has provided this specific context about their relationship with this physician — incorporate it naturally and let it shape the email's angle: ${instruction}\n`
    : "";

  const userPrompt = `${intent}
${campaignContext ? `\nCampaign context:\n${campaignContext}\n` : ""}${instructionBlock}
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

Write a personalized email to Dr. ${physician.lastName}. Reference their ${subSpecialty} focus at ${physician.affiliation} naturally, and make it feel individually written.${brief ? " Keep the original intent of the brief." : ""}${instruction ? " The sender-provided context above is the most important thing to get right." : ""}`;

  return callLLM(SYSTEM_PROMPT, userPrompt);
}
