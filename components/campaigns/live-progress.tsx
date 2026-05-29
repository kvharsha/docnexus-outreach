"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const POLL_MS = 3000;

type Progress = {
  status: string;
  total: number;
  sent: number;
  pending: number;
  simulated: number;
  real: number;
};

// Only meaningful while the drain is running. Polls /progress every 3s, and once the queue empties
// it refreshes the server component so the page flips to its 'completed' state.
export function LiveProgress({
  campaignId,
  initialStatus,
}: {
  campaignId: string;
  initialStatus: string;
}) {
  const router = useRouter();
  const [progress, setProgress] = useState<Progress | null>(null);

  useEffect(() => {
    if (initialStatus !== "active") return;

    let cancelled = false;
    let timer: ReturnType<typeof setInterval> | undefined;

    const poll = async () => {
      try {
        const res = await fetch(`/api/campaigns/${campaignId}/progress`);
        if (!res.ok || cancelled) return;
        const data: Progress = await res.json();
        if (cancelled) return;
        setProgress(data);

        // Queue drained — stop polling and re-run the server component to pick up final counts + status.
        if (data.pending === 0) {
          if (timer) clearInterval(timer);
          router.refresh();
        }
      } catch {
        // Transient network error — leave the interval running and try again next tick.
      }
    };

    poll(); // read once immediately so the bar appears without a 3s wait
    timer = setInterval(poll, POLL_MS);
    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
    };
  }, [campaignId, initialStatus, router]);

  // Nothing to show unless we're actively draining and have a reading.
  if (initialStatus !== "active" || !progress) return null;

  // sent/pending are message-level (enrollments × steps); total here is the queue size.
  const totalSends = progress.sent + progress.pending;
  const pct = totalSends === 0 ? 0 : Math.round((progress.sent / totalSends) * 100);

  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium text-zinc-950">Sending in progress</span>
        <span className="text-zinc-600 tabular-nums">
          Sent {progress.sent} of {totalSends} · {progress.pending} pending
        </span>
      </div>
      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-zinc-100">
        <div
          className="h-full rounded-full bg-teal-700 transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
