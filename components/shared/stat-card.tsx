import type { LucideIcon } from "lucide-react";

type Props = {
  label: string;
  value: string | number;
  // Optional second line, e.g. "30 real · 6 simulated" under Messages Sent.
  sub?: string;
  icon?: LucideIcon;
};

export function StatCard({ label, value, sub, icon: Icon }: Props) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4">
      <div className="flex items-center gap-1.5 text-xs text-zinc-500">
        {Icon && <Icon className="size-3.5" />}
        {label}
      </div>
      {/* tabular-nums so figures line up across the row of cards. */}
      <p className="mt-1.5 text-2xl font-semibold text-zinc-950 tabular-nums">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-zinc-400 tabular-nums">{sub}</p>}
    </div>
  );
}
