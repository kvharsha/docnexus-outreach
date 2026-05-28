import { prisma } from "@/lib/db";
import type { CreateCampaignInput } from "@/lib/validators/campaigns";

// Typed errors so the route layer can map them to the right status code without sniffing strings.
export class CampaignNotFoundError extends Error {}
export class CampaignNotDraftError extends Error {}

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

export async function getCampaignById(id: string) {
  return prisma.campaign.findUnique({
    where: { id },
    include: {
      sequences: { orderBy: { stepNumber: "asc" } },
      enrollments: { include: { physician: true } },
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
