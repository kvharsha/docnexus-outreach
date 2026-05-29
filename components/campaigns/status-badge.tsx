import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

// Covers both the campaign lifecycle (draft/active/completed) and per-contact state
// (pending/contacted/replied/bounced). The label + styling for each lives in one map so a badge
// anywhere in the app reads the same.
const STATUS_STYLES: Record<string, { label: string; className: string }> = {
  // Campaign lifecycle
  draft: { label: "Draft", className: "bg-zinc-100 text-zinc-600" },
  active: { label: "Active", className: "bg-teal-700/10 text-teal-700" },
  completed: { label: "Completed", className: "bg-zinc-900 text-white" },
  // Per-contact
  pending: { label: "Pending", className: "bg-zinc-100 text-zinc-500" },
  contacted: { label: "Contacted", className: "bg-teal-700/10 text-teal-700" },
  replied: { label: "Replied", className: "bg-teal-700 text-white" },
  bounced: { label: "Bounced", className: "bg-destructive/10 text-destructive" },
};

export function StatusBadge({ status, className }: { status: string; className?: string }) {
  // Unknown status shouldn't crash the page — show the raw value in a neutral badge.
  const style = STATUS_STYLES[status] ?? { label: status, className: "bg-zinc-100 text-zinc-600" };

  return (
    <Badge variant="secondary" className={cn("border-transparent", style.className, className)}>
      {style.label}
    </Badge>
  );
}
