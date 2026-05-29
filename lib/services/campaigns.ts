import { prisma } from "@/lib/db";
import { generatePersonalizedEmail } from "@/lib/services/ai";
import { sendOrSimulate } from "@/lib/services/mailer";
import type {
  CreateCampaignInput,
  DraftOverrideInput,
  PersistOverridesInput,
} from "@/lib/validators/campaigns";

// Typed errors so the route layer can map them to the right status code without sniffing strings.
export class CampaignNotFoundError extends Error {}
export class CampaignNotDraftError extends Error {}
export class PhysicianNotFoundError extends Error {}

export async function listCampaigns() {
  return prisma.campaign.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      type: true,
      status: true,
      createdAt: true,
      _count: { select: { enrollments: true } },
    },
  });
}

export async function createCampaign(data: CreateCampaignInput) {
  // One interactive transaction: the campaign, its steps, and its enrollments either all land or none do.
  // A bad physicianId trips the foreign key and rolls the whole thing back — no half-built campaign.
  return prisma.$transaction((tx) =>
    tx.campaign.create({
      data: {
        name: data.name,
        type: data.type,
        sequences: {
          create: data.sequences.map((s) => ({
            stepNumber: s.stepNumber,
            delayDays: s.delayDays,
            subjectTemplate: s.subjectTemplate,
            bodyTemplate: s.bodyTemplate,
          })),
        },
        enrollments: {
          create: data.physicianIds.map((physicianId) => ({ physicianId })),
        },
      },
      include: {
        sequences: { orderBy: { stepNumber: "asc" } },
        enrollments: true,
      },
    }),
  );
}

// Builder-time: produce a personalized override draft for one physician on one step. The campaign
// doesn't exist yet, so we work straight from the request + the physician record.
export async function generateOverrideDraft(input: DraftOverrideInput) {
  const physician = await prisma.physician.findUnique({ where: { id: input.physicianId } });
  if (!physician) throw new PhysicianNotFoundError();

  return generatePersonalizedEmail({
    physician,
    stepNumber: input.stepNumber,
    brief: input.brief,
    campaignName: input.campaignName,
    campaignType: input.campaignType,
    instruction: input.instruction,
  });
}

// After the campaign is created, persist whatever overrides the user accumulated in the builder.
export async function persistCampaignOverrides(campaignId: string, input: PersistOverridesInput) {
  const campaign = await prisma.campaign.findUnique({ where: { id: campaignId }, select: { id: true } });
  if (!campaign) throw new CampaignNotFoundError();

  await prisma.campaignDraftOverride.createMany({
    data: input.overrides.map((o) => ({
      campaignId,
      physicianId: o.physicianId,
      stepNumber: o.stepNumber,
      subject: o.subject,
      body: o.body,
    })),
  });

  return { count: input.overrides.length };
}

export async function getCampaignById(id: string) {
  return prisma.campaign.findUnique({
    where: { id },
    include: {
      sequences: { orderBy: { stepNumber: "asc" } },
      enrollments: { include: { physician: true } },
    },
  });
}

// Everything the dashboard needs in one query: enrollments (with physician), sent messages (for the
// real/simulated split), and just the override keys (to tag personalized recipients). Kept separate
// from getCampaignById so the GET /api/campaigns/:id contract stays lean.
export async function getCampaignDashboard(id: string) {
  return prisma.campaign.findUnique({
    where: { id },
    include: {
      enrollments: { include: { physician: true } },
      sentMessages: true,
      overrides: { select: { physicianId: true, stepNumber: true } },
    },
  });
}

export async function launchCampaign(id: string) {
  // The whole launch is one transaction: re-read status, queue the sends, flip to active — atomically.
  // Reading status inside the tx (not before it) closes the double-launch race on serverless.
  return prisma.$transaction(async (tx) => {
    const campaign = await tx.campaign.findUnique({
      where: { id },
      include: { sequences: true, enrollments: true },
    });

    if (!campaign) throw new CampaignNotFoundError();
    if (campaign.status !== "draft") throw new CampaignNotDraftError();

    // Fan out: one pending send per enrolled physician per step. 36 physicians × 2 steps = 72 rows.
    const pending = campaign.enrollments.flatMap((enrollment) =>
      campaign.sequences.map((step) => ({
        campaignId: id,
        physicianId: enrollment.physicianId,
        stepNumber: step.stepNumber,
      })),
    );

    if (pending.length > 0) {
      await tx.pendingSend.createMany({ data: pending });
    }

    const updated = await tx.campaign.update({
      where: { id },
      data: { status: "active" },
    });

    return { campaign: updated, pendingCount: pending.length };
  });
}

export async function getCampaignProgress(id: string) {
  const campaign = await prisma.campaign.findUnique({
    where: { id },
    select: { status: true },
  });

  if (!campaign) throw new CampaignNotFoundError();

  // total = enrolled physicians; pending = individual sends still queued (enrollments × steps).
  // They're different units, so we can't derive one from the other.
  const [total, sent, pending, simulated, real] = await Promise.all([
    prisma.campaignEnrollment.count({ where: { campaignId: id } }),
    prisma.sentMessage.count({ where: { campaignId: id } }),
    prisma.pendingSend.count({ where: { campaignId: id } }),
    prisma.sentMessage.count({ where: { campaignId: id, simulated: true } }),
    prisma.sentMessage.count({ where: { campaignId: id, simulated: false } }),
  ]);

  return {
    status: campaign.status,
    total,
    sent,
    pending,
    simulated,
    real,
  };
}

// Fire-and-forget worker kicked off by the launch route via setImmediate. Walks the PendingSend
// queue one row at a time: personalize → send → record → delete. Pacing lives in the mailer, so
// this loop just awaits each send. If the process dies mid-drain, the undeleted PendingSend rows
// are the resume point — a re-launch endpoint would pick them back up (noted as future work).
export async function drainPendingSends(campaignId: string) {
  const queue = await prisma.pendingSend.findMany({
    where: { campaignId },
    orderBy: { createdAt: "asc" },
  });

  for (const item of queue) {
    const [physician, step] = await Promise.all([
      prisma.physician.findUnique({ where: { id: item.physicianId } }),
      prisma.sequenceStep.findUnique({
        where: { campaignId_stepNumber: { campaignId, stepNumber: item.stepNumber } },
      }),
    ]);

    // A missing physician or step means the data was tampered with between launch and drain.
    // Nothing useful to send, so drop the row and move on rather than wedging the queue.
    if (!physician || !step) {
      await prisma.pendingSend.delete({ where: { id: item.id } });
      continue;
    }

    // If the user wrote a custom override for this physician/step, it's already final — send it
    // verbatim and skip the AI call entirely. Otherwise fall back to the shared-template rewrite.
    const override = await prisma.campaignDraftOverride.findUnique({
      where: {
        campaignId_physicianId_stepNumber: {
          campaignId,
          physicianId: physician.id,
          stepNumber: item.stepNumber,
        },
      },
    });

    let email: { subject: string; body: string };
    if (override) {
      email = { subject: override.subject, body: override.body };
    } else {
      try {
        email = await generatePersonalizedEmail({
          brief: step.bodyTemplate,
          physician,
          stepNumber: item.stepNumber,
        });
      } catch (err) {
        // Gemini choked on this one. Mark the enrollment bounced so the dashboard shows the failure,
        // then drop the pending row so the queue keeps draining instead of stalling on a bad recipient.
        console.error(`drain: AI failed for physician ${physician.id} in campaign ${campaignId}`, err);
        await prisma.campaignEnrollment.updateMany({
          where: { campaignId, physicianId: physician.id },
          data: { status: "bounced" },
        });
        await prisma.pendingSend.delete({ where: { id: item.id } });
        continue;
      }
    }

    const result = await sendOrSimulate({
      to: physician.email,
      subject: email.subject,
      body: email.body,
    });

    // Record the send, advance the enrollment, and clear the queue row as one logical step.
    await prisma.$transaction([
      prisma.sentMessage.create({
        data: {
          campaignId,
          physicianId: physician.id,
          stepNumber: item.stepNumber,
          subject: email.subject,
          body: email.body,
          simulated: result.simulated,
          smtpMessageId: result.messageId ?? null,
        },
      }),
      prisma.campaignEnrollment.updateMany({
        where: { campaignId, physicianId: physician.id },
        data: { status: "contacted" },
      }),
      prisma.pendingSend.delete({ where: { id: item.id } }),
    ]);
  }

  await prisma.campaign.update({
    where: { id: campaignId },
    data: { status: "completed" },
  });
}
