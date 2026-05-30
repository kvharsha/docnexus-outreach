import { notFound } from "next/navigation";
import { CalendarDays, CheckCircle2, Mail, MessageSquare, Users } from "lucide-react";

import { getCampaignDashboard } from "@/lib/services/campaigns";
import {
  getCampaignMetrics,
  resolveContactStatus,
  type ContactStatus,
} from "@/lib/utils/mock-metrics";
import { ActivityChart } from "@/components/campaigns/activity-chart";
import { LiveProgress } from "@/components/campaigns/live-progress";
import { StatusBadge } from "@/components/campaigns/status-badge";
import { StatCard } from "@/components/shared/stat-card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

// Reflect live DB state on every request (a just-launched campaign must never serve a cached view).
export const dynamic = "force-dynamic";

const TYPE_LABELS: Record<string, string> = {
  cold_outbound: "Cold Outbound",
  reengagement: "Re-engagement",
  conference_followup: "Conference Follow-up",
};

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

// Hot leads first, dead ends last — how a rep wants to scan the list.
const STATUS_ORDER: ContactStatus[] = ["replied", "contacted", "pending", "bounced"];

export default async function CampaignDashboardPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const campaign = await getCampaignDashboard(id);
  if (!campaign) notFound();

  const enrolledCount = campaign.enrollments.length;
  const messagesSent = campaign.sentMessages.length;
  const realCount = campaign.sentMessages.filter((m) => !m.simulated).length;
  const simulatedCount = messagesSent - realCount;

  // Mock engagement metrics only mean something once a campaign has sent something. A draft shows
  // zeros / em-dashes, not invented numbers.
  const isLaunched = campaign.status !== "draft";
  const metrics = isLaunched ? getCampaignMetrics(campaign.id, enrolledCount) : null;
  const repliesCount = metrics ? Math.round((metrics.replyRate / 100) * messagesSent) : 0;

  // Physicians with at least one override get a "Personalized" tag.
  const overriddenIds = new Set(campaign.overrides.map((o) => o.physicianId));

  const rows = campaign.enrollments
    .map((e) => ({
      id: e.id,
      physician: e.physician,
      status: resolveContactStatus(campaign.id, e.physicianId, e.status, campaign.status),
      isPersonalized: overriddenIds.has(e.physicianId),
    }))
    .sort((a, b) => STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status));

  return (
    <div className="px-8 py-6">
      <header className="flex items-start justify-between gap-4 pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-lg font-semibold text-zinc-950">{campaign.name}</h1>
            <StatusBadge status={campaign.status} />
          </div>
          <p className="mt-1 flex items-center gap-1.5 text-sm text-zinc-600">
            {TYPE_LABELS[campaign.type] ?? campaign.type}
            <span className="text-zinc-300">·</span>
            <CalendarDays className="size-3.5" />
            <span className="tabular-nums">{dateFormatter.format(campaign.createdAt)}</span>
          </p>
        </div>
      </header>

      {/* Only renders while the drain is active; refreshes the page to 'completed' when done. */}
      <div className="pb-5">
        <LiveProgress campaignId={campaign.id} initialStatus={campaign.status} />
      </div>

      <div className="grid grid-cols-2 gap-3 pb-5 md:grid-cols-3 xl:grid-cols-5">
        <StatCard label="Physicians Enrolled" value={enrolledCount} icon={Users} />
        <StatCard
          label="Messages Sent"
          value={messagesSent}
          sub={messagesSent > 0 ? `${realCount} real · ${simulatedCount} simulated` : undefined}
          icon={Mail}
        />
        <StatCard
          label="Open Rate"
          value={metrics ? `${metrics.openRate}%` : "—"}
          icon={MessageSquare}
        />
        <StatCard
          label="Replies"
          value={repliesCount}
          sub={metrics ? `${metrics.replyRate}% of sent` : undefined}
          icon={MessageSquare}
        />
        <StatCard
          label="Meetings Booked"
          value={metrics ? metrics.meetingsBooked : 0}
          icon={CheckCircle2}
        />
      </div>

      <div className="pb-5">
        <ActivityChart
          campaignId={campaign.id}
          enrolledCount={enrolledCount}
          launched={isLaunched}
        />
      </div>

      <div className="overflow-hidden rounded-lg border border-zinc-200 bg-white">
        <div className="border-b border-zinc-200 px-4 py-2.5">
          <h2 className="text-sm font-medium text-zinc-950">Enrolled physicians</h2>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Physician</TableHead>
              <TableHead>Affiliation</TableHead>
              <TableHead className="text-right">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.id}>
                <TableCell className="font-medium text-zinc-950">
                  <span className="flex items-center gap-2">
                    Dr. {row.physician.firstName} {row.physician.lastName}
                    {row.isPersonalized && (
                      <span className="flex items-center gap-1 text-xs font-medium text-teal-700">
                        <span className="size-1.5 rounded-full bg-teal-700" />
                        Personalized
                      </span>
                    )}
                  </span>
                </TableCell>
                <TableCell className="text-zinc-600">{row.physician.affiliation}</TableCell>
                <TableCell className="text-right">
                  <StatusBadge status={row.status} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
