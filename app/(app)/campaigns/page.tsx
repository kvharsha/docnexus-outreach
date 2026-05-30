import Link from "next/link";
import { Megaphone } from "lucide-react";

import { listCampaigns } from "@/lib/services/campaigns";
import { StatusBadge } from "@/components/campaigns/status-badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

// Always query the DB on each request. Without this, Next prerenders this page statically at build
// time — on Vercel that's against an empty prod DB, so the list would be permanently empty even
// after campaigns are created at runtime.
export const dynamic = "force-dynamic";

const TYPE_LABELS: Record<string, string> = {
  cold_outbound: "Cold Outbound",
  reengagement: "Re-engagement",
  conference_followup: "Conference Follow-up",
};

// Fixed locale so the server-rendered date is stable regardless of the host's locale.
const dateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

export default async function CampaignsPage() {
  const campaigns = await listCampaigns();

  return (
    <div className="px-8 py-6">
      <header className="pb-5">
        <h1 className="text-lg font-semibold text-zinc-950">Campaigns</h1>
        <p className="text-sm text-zinc-600">Outreach campaigns you&apos;ve created.</p>
      </header>

      {campaigns.length === 0 ? (
        <div className="rounded-lg border border-dashed border-zinc-300 bg-white px-6 py-16 text-center">
          <Megaphone className="mx-auto size-6 text-zinc-400" />
          <p className="mt-3 text-sm font-medium text-zinc-950">No campaigns yet</p>
          <p className="mt-1 text-sm text-zinc-600">
            Start by selecting physicians, then build a campaign.
          </p>
          <Button asChild size="sm" className="mt-4 bg-teal-700 text-white hover:bg-teal-700/90">
            <Link href="/physicians">Find physicians</Link>
          </Button>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-zinc-200 bg-white">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Enrolled</TableHead>
                <TableHead>Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {campaigns.map((c) => (
                <TableRow key={c.id} className="cursor-pointer">
                  <TableCell className="font-medium text-zinc-950">
                    {/* Whole-row link: the cell anchor stretches over the row via absolute inset. */}
                    <Link href={`/campaigns/${c.id}`} className="hover:underline">
                      {c.name}
                    </Link>
                  </TableCell>
                  <TableCell className="text-zinc-600">{TYPE_LABELS[c.type] ?? c.type}</TableCell>
                  <TableCell>
                    <StatusBadge status={c.status} />
                  </TableCell>
                  <TableCell className="text-right text-zinc-950 tabular-nums">
                    {c._count.enrollments}
                  </TableCell>
                  <TableCell className="text-zinc-600 tabular-nums">
                    {dateFormatter.format(c.createdAt)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
