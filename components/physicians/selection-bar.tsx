"use client";

import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  SELECTION_STORAGE_KEY,
  useSelection,
} from "@/components/physicians/selection-provider";

type Props = { shown: number; total: number };

export function SelectionBar({ shown, total }: Props) {
  const router = useRouter();
  const { selectedIds, count, clear } = useSelection();

  const handleSave = () => {
    // The provider already mirrors this to sessionStorage, but write once more right before we leave
    // so the builder is guaranteed to read the current selection even if the effect hasn't flushed.
    sessionStorage.setItem(SELECTION_STORAGE_KEY, JSON.stringify(selectedIds));
    router.push("/campaigns/new");
  };

  return (
    <div className="sticky bottom-0 flex items-center justify-between border-t border-zinc-200 bg-white/95 px-8 py-3 backdrop-blur-none">
      <p className="text-sm text-zinc-600">
        <span className="tabular-nums text-zinc-950">{shown}</span> of{" "}
        <span className="tabular-nums text-zinc-950">{total}</span> physicians
        {" — "}
        <span className="tabular-nums font-medium text-zinc-950">{count}</span> selected
      </p>

      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={clear} disabled={count === 0}>
          Clear
        </Button>
        <Button
          size="sm"
          onClick={handleSave}
          disabled={count === 0}
          className="bg-teal-700 text-white hover:bg-teal-700/90"
        >
          Save &amp; Add to Campaign
          <ArrowRight className="size-4" />
        </Button>
      </div>
    </div>
  );
}
