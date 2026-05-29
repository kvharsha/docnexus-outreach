"use client";

import { Check } from "lucide-react";

import { cn } from "@/lib/utils";

export const BUILDER_STEPS = ["Details", "Sequence", "Review"] as const;
export type BuilderStep = 0 | 1 | 2;

type Props = {
  current: BuilderStep;
  // Lets the user jump back to a completed step; forward jumps are blocked by the caller's validation.
  onStepClick: (step: BuilderStep) => void;
};

export function BuilderStepper({ current, onStepClick }: Props) {
  return (
    <ol className="flex items-center gap-2">
      {BUILDER_STEPS.map((label, index) => {
        const isDone = index < current;
        const isCurrent = index === current;

        return (
          <li key={label} className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onStepClick(index as BuilderStep)}
              // Only completed or current steps are reachable; future steps wait on validation.
              disabled={index > current}
              className={cn(
                "flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm transition-colors",
                isCurrent && "bg-zinc-200/70 font-medium text-zinc-950",
                isDone && "text-zinc-600 hover:bg-zinc-200/50",
                !isCurrent && !isDone && "cursor-not-allowed text-zinc-400",
              )}
            >
              <span
                className={cn(
                  "flex size-5 items-center justify-center rounded-full text-xs tabular-nums",
                  isCurrent && "bg-teal-700 text-white",
                  isDone && "bg-teal-700/15 text-teal-700",
                  !isCurrent && !isDone && "bg-zinc-200 text-zinc-500",
                )}
              >
                {isDone ? <Check className="size-3" /> : index + 1}
              </span>
              {label}
            </button>

            {index < BUILDER_STEPS.length - 1 && (
              <span className="h-px w-8 bg-zinc-200" aria-hidden />
            )}
          </li>
        );
      })}
    </ol>
  );
}
