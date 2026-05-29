"use client";

import { Sparkles, X } from "lucide-react";

import type { Physician } from "@/generated/prisma/client";
import { physicianToVars, renderTemplate } from "@/lib/utils/template";
import type { OverridesMap } from "@/components/campaigns/types";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Props = {
  physicians: Physician[];
  subject: string;
  body: string;
  stepNumber: number;
  previewId: string;
  onPreviewIdChange: (id: string) => void;
  overrides: OverridesMap;
  onRemoveOverride: (physicianId: string, stepNumber: number) => void;
};

export function PreviewPanel({
  physicians,
  subject,
  body,
  stepNumber,
  previewId,
  onPreviewIdChange,
  overrides,
  onRemoveOverride,
}: Props) {
  const physician = physicians.find((p) => p.id === previewId) ?? physicians[0];
  const override = physician ? overrides[physician.id]?.[stepNumber] : undefined;

  // An override is already in final form — render it verbatim. Otherwise substitute variables into
  // the shared template so the user sees this physician's real details.
  const vars = physician ? physicianToVars(physician) : {};
  const renderedSubject = override ? override.subject : renderTemplate(subject, vars);
  const renderedBody = override ? override.body : renderTemplate(body, vars);

  return (
    <aside className="sticky top-6 h-fit w-96 shrink-0">
      <div className="rounded-lg border border-zinc-200 bg-white">
        <div className="border-b border-zinc-200 p-4">
          <h3 className="text-sm font-medium text-zinc-950">
            Preview · <span className="tabular-nums">Step {stepNumber}</span>
          </h3>
          <p className="mt-1 text-xs text-zinc-400">
            This is what gets sent: the template with each physician&apos;s details filled in (or
            their saved override, verbatim). No AI runs at launch.
          </p>
        </div>

        <div className="flex flex-col gap-3 p-4">
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs text-zinc-600">Preview as</Label>
            <Select value={previewId} onValueChange={onPreviewIdChange}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select a physician" />
              </SelectTrigger>
              <SelectContent>
                {physicians.map((p) => {
                  const hasOverride = Boolean(overrides[p.id]?.[stepNumber]);
                  return (
                    <SelectItem key={p.id} value={p.id}>
                      <span className="flex items-center gap-1.5">
                        {hasOverride && (
                          // Teal dot flags physicians with a custom version for this step.
                          <span
                            title="Has personalized override"
                            className="size-1.5 shrink-0 rounded-full bg-teal-700"
                          />
                        )}
                        Dr. {p.firstName} {p.lastName} — {p.specialty}
                      </span>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>

          {override && physician && (
            <div className="flex items-center justify-between rounded-md bg-teal-700/10 px-2.5 py-1.5">
              <span className="flex items-center gap-1.5 text-xs font-medium text-teal-700">
                <Sparkles className="size-3" />
                Personalized for Dr. {physician.lastName}
              </span>
              <button
                type="button"
                onClick={() => onRemoveOverride(physician.id, stepNumber)}
                className="flex items-center gap-0.5 text-xs text-zinc-500 transition-colors hover:text-zinc-950"
              >
                <X className="size-3" />
                Remove override
              </button>
            </div>
          )}

          <div className="rounded-lg border border-zinc-200 bg-[#fafafa] p-3">
            <p className="text-xs text-zinc-400">Subject</p>
            <p className="mt-0.5 text-sm font-medium text-zinc-950">
              {renderedSubject || <span className="text-zinc-400">No subject yet</span>}
            </p>

            <div className="my-3 h-px bg-zinc-200" />

            <p className="text-xs text-zinc-400">Body</p>
            {renderedBody ? (
              <p className="mt-0.5 text-sm whitespace-pre-wrap text-zinc-700">{renderedBody}</p>
            ) : (
              <p className="mt-0.5 text-sm text-zinc-400">No body yet</p>
            )}
          </div>
        </div>
      </div>
    </aside>
  );
}
