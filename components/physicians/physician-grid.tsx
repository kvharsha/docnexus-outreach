"use client";

import type { Physician } from "@/generated/prisma/client";
import { PhysicianCard } from "@/components/physicians/physician-card";
import { useSelection } from "@/components/physicians/selection-provider";

type Props = {
  physicians: Physician[];
  // Only pin selected-to-top on the unfiltered view; once a filter is active, respect the query order.
  pinSelected: boolean;
};

// Selected physicians first (in the order they were picked), then everyone else in server order.
function reorderSelectedFirst(physicians: Physician[], selectedIds: string[]): Physician[] {
  const byId = new Map(physicians.map((p) => [p.id, p]));
  const selected = selectedIds
    .map((id) => byId.get(id))
    .filter((p): p is Physician => Boolean(p));
  const selectedSet = new Set(selectedIds);
  const rest = physicians.filter((p) => !selectedSet.has(p.id));
  return [...selected, ...rest];
}

export function PhysicianGrid({ physicians, pinSelected }: Props) {
  // selectedIds is empty on the server and first client render (the provider hydrates from
  // sessionStorage after mount), so the reorder is a post-hydration update — no mismatch.
  const { selectedIds } = useSelection();

  const ordered =
    pinSelected && selectedIds.length > 0
      ? reorderSelectedFirst(physicians, selectedIds)
      : physicians;

  return (
    <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
      {ordered.map((physician) => (
        <PhysicianCard key={physician.id} physician={physician} />
      ))}
    </div>
  );
}
