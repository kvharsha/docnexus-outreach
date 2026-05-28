"use client";

import { useEffect, useState } from "react";
import { BadgeCheck, MapPin } from "lucide-react";

import type { Physician } from "@/generated/prisma/client";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { useSelection } from "@/components/physicians/selection-provider";

export function PhysicianCard({ physician }: { physician: Physician }) {
  const { isSelected, toggle } = useSelection();
  const selected = isSelected(physician.id);
  const yearsExperience = new Date().getFullYear() - physician.npiRegistrationYear;

  // Selection lives in sessionStorage, which the server can't see — so until we've mounted on the
  // client, render the unchecked state the server produced. Flipping after mount avoids a hydration
  // mismatch on the checkbox.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const showSelected = mounted && selected;

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    // Reproduce native button keyboard behaviour: Enter/Space activate, and Space shouldn't scroll.
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      toggle(physician.id);
    }
  };

  return (
    // A real <button> can't wrap the shadcn Checkbox (it renders its own <button> — invalid nesting),
    // so this is a div with full button semantics added by hand.
    <div
      role="button"
      tabIndex={0}
      onClick={() => toggle(physician.id)}
      onKeyDown={handleKeyDown}
      aria-pressed={showSelected}
      className={cn(
        "flex w-full cursor-pointer items-start gap-3 rounded-lg border bg-white p-4 text-left transition-colors focus-visible:ring-2 focus-visible:ring-teal-700 focus-visible:outline-none",
        showSelected
          ? "border-teal-700 ring-1 ring-teal-700"
          : "border-zinc-200 hover:border-zinc-300",
      )}
    >
      {/* Checkbox is presentational here — the whole card is the click target. */}
      <Checkbox checked={showSelected} tabIndex={-1} className="mt-1 pointer-events-none" />

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <h3 className="truncate text-sm font-semibold text-zinc-950">
            Dr. {physician.firstName} {physician.lastName}
          </h3>
          {physician.boardCertified && (
            <Badge variant="secondary" className="gap-1 text-teal-700">
              <BadgeCheck className="size-3" />
              Board certified
            </Badge>
          )}
        </div>

        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
          <Badge variant="outline">{physician.specialty}</Badge>
          {physician.subSpecialty && (
            <Badge variant="ghost" className="text-zinc-600">
              {physician.subSpecialty}
            </Badge>
          )}
        </div>

        <p className="mt-2 truncate text-sm text-zinc-600">{physician.affiliation}</p>

        <div className="mt-1 flex items-center gap-3 text-xs text-zinc-400">
          <span className="flex items-center gap-1">
            <MapPin className="size-3" />
            {physician.city}, {physician.state}
          </span>
          <span className="tabular-nums">{yearsExperience} yrs experience</span>
        </div>
      </div>
    </div>
  );
}
