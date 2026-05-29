"use client";

import { useRef, useState } from "react";
import { useFormContext } from "react-hook-form";
import { Loader2, Sparkles, Trash2, UserPen, X } from "lucide-react";
import { toast } from "sonner";

import type { Physician } from "@/generated/prisma/client";
import type { CreateCampaignInput } from "@/lib/validators/campaigns";
import { TEMPLATE_VARIABLES } from "@/lib/utils/template";
import type { OverrideDraft } from "@/components/campaigns/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

type Props = {
  index: number;
  // Step 1 can't be removed and is pinned to "sent immediately"; only follow-ups get a remove button.
  isFirst: boolean;
  onRemove: () => void;
  onActivate: () => void;
  // The physician currently chosen in the preview — the target for a personalized override.
  previewPhysician?: Physician;
  // That physician's override for this step, if one exists. When present, the editor edits it
  // instead of the shared template.
  override?: OverrideDraft;
  // Per-physician-per-step instruction text (in-memory only, not persisted to the DB).
  instruction: string;
  onInstructionChange: (value: string) => void;
  onSaveOverride: (physicianId: string, stepNumber: number, draft: OverrideDraft) => void;
  onRemoveOverride: (physicianId: string, stepNumber: number) => void;
};

export function SequenceStepEditor({
  index,
  isFirst,
  onRemove,
  onActivate,
  previewPhysician,
  override,
  instruction,
  onInstructionChange,
  onSaveOverride,
  onRemoveOverride,
}: Props) {
  const { register, setValue, watch, formState } = useFormContext<CreateCampaignInput>();
  const bodyRef = useRef<HTMLTextAreaElement | null>(null);
  const [generating, setGenerating] = useState(false);
  const [personalizing, setPersonalizing] = useState(false);

  const stepNumber = index + 1;
  const campaignType = watch("type");
  const errors = formState.errors.sequences?.[index];

  // Override mode = we're editing a specific physician's custom version, not the shared template.
  const isOverrideMode = Boolean(previewPhysician && override);

  // Patch the active physician's override in place as the user edits the controlled fields.
  const updateOverride = (patch: Partial<OverrideDraft>) => {
    if (!previewPhysician || !override) return;
    onSaveOverride(previewPhysician.id, stepNumber, { ...override, ...patch });
  };

  // Keep both editor fields controlled for their whole lifetime. The value is never undefined
  // (watch can return undefined mid-render, so we default to ""), and one onChange routes the edit
  // to the override or the shared template. Swapping register() in and out is what triggered React's
  // controlled/uncontrolled warning, so neither field uses register anymore.
  const subjectValue = isOverrideMode && override
    ? override.subject
    : (watch(`sequences.${index}.subjectTemplate`) ?? "");
  const bodyValue = isOverrideMode && override
    ? override.body
    : (watch(`sequences.${index}.bodyTemplate`) ?? "");

  const handleSubjectChange = (value: string) => {
    if (isOverrideMode) updateOverride({ subject: value });
    else setValue(`sequences.${index}.subjectTemplate`, value, { shouldValidate: true });
  };
  const handleBodyChange = (value: string) => {
    if (isOverrideMode) updateOverride({ body: value });
    else setValue(`sequences.${index}.bodyTemplate`, value, { shouldValidate: true });
  };

  // Insert a {{variable}} at the cursor in the body, then restore focus just past what we inserted.
  // Only used for the shared template — overrides are final text and don't take variables.
  const insertVariable = (variable: string) => {
    const textarea = bodyRef.current;
    const token = `{{${variable}}}`;
    const current = watch(`sequences.${index}.bodyTemplate`) ?? "";

    if (!textarea) {
      setValue(`sequences.${index}.bodyTemplate`, current + token, { shouldValidate: true });
      return;
    }

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const next = current.slice(0, start) + token + current.slice(end);
    setValue(`sequences.${index}.bodyTemplate`, next, { shouldValidate: true });

    // React re-renders before the cursor can move, so defer to the next frame.
    requestAnimationFrame(() => {
      textarea.focus();
      const caret = start + token.length;
      textarea.setSelectionRange(caret, caret);
    });
  };

  const generateWithAI = async () => {
    setGenerating(true);
    try {
      const res = await fetch("/api/ai/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ campaignType, stepNumber }),
      });

      if (!res.ok) {
        // 503 = no key configured, 502 = model failed. Both come back with a readable error string.
        const detail = await res.json().catch(() => null);
        const message =
          res.status === 503
            ? "AI isn't configured on this environment."
            : (detail?.error ?? "AI request failed. Try again.");
        toast.error(message);
        return;
      }

      const draft: { subject: string; body: string } = await res.json();
      setValue(`sequences.${index}.subjectTemplate`, draft.subject, { shouldValidate: true });
      setValue(`sequences.${index}.bodyTemplate`, draft.body, { shouldValidate: true });
      toast.success(`Draft generated for step ${stepNumber}.`);
    } catch {
      toast.error("Couldn't reach the AI service.");
    } finally {
      setGenerating(false);
    }
  };

  // Generate (or regenerate) a custom version for the selected physician. The instruction is what
  // makes this differ from the shared draft — it's sent alongside the shared body as a starting brief.
  const personalizeForPhysician = async () => {
    if (!previewPhysician) return;
    setPersonalizing(true);
    try {
      const res = await fetch("/api/campaigns/draft-override", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          campaignName: watch("name"),
          campaignType,
          stepNumber,
          physicianId: previewPhysician.id,
          brief: watch(`sequences.${index}.bodyTemplate`) || undefined,
          instruction: instruction || undefined,
        }),
      });

      if (!res.ok) {
        const detail = await res.json().catch(() => null);
        const message =
          res.status === 503
            ? "AI isn't configured on this environment."
            : (detail?.error ?? "Couldn't generate the override.");
        toast.error(message);
        return;
      }

      const draft: OverrideDraft = await res.json();
      onSaveOverride(previewPhysician.id, stepNumber, draft);
      toast.success(`Personalized override saved for Dr. ${previewPhysician.lastName}.`);
    } catch {
      toast.error("Couldn't reach the AI service.");
    } finally {
      setPersonalizing(false);
    }
  };

  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4">
      <div className="flex items-center justify-between pb-3">
        <div className="flex items-center gap-2">
          <span className="flex size-5 items-center justify-center rounded-full bg-zinc-100 text-xs tabular-nums text-zinc-600">
            {stepNumber}
          </span>
          <span className="text-sm font-medium text-zinc-950">
            {isFirst ? "Initial outreach" : `Follow-up ${index}`}
          </span>
        </div>

        {!isFirst && (
          <Button type="button" variant="ghost" size="sm" onClick={onRemove} className="text-zinc-500">
            <Trash2 className="size-3.5" />
            Remove
          </Button>
        )}
      </div>

      {/* Timing: step 1 is fixed, follow-ups wait N days after the previous send with no reply. */}
      {isFirst ? (
        <p className="pb-3 text-xs text-zinc-500">Sent immediately when the campaign launches.</p>
      ) : (
        <div className="flex items-center gap-2 pb-3 text-xs text-zinc-500">
          <span>Sent</span>
          <Input
            type="number"
            min={1}
            className="h-7 w-16 tabular-nums"
            {...register(`sequences.${index}.delayDays`, { valueAsNumber: true })}
          />
          <span>days after previous if no reply.</span>
        </div>
      )}

      {/* Banner makes it unmistakable whether edits hit the shared template or one physician's override. */}
      {isOverrideMode ? (
        <div className="mb-3 flex items-center justify-between rounded-md bg-teal-700/10 px-2.5 py-1.5">
          <span className="flex items-center gap-1.5 text-xs font-medium text-teal-700">
            <UserPen className="size-3" />
            Editing personalized override for Dr. {previewPhysician?.lastName}
          </span>
          <button
            type="button"
            onClick={() => previewPhysician && onRemoveOverride(previewPhysician.id, stepNumber)}
            className="flex items-center gap-0.5 text-xs text-zinc-500 transition-colors hover:text-zinc-950"
          >
            <X className="size-3" />
            Remove override
          </button>
        </div>
      ) : (
        <div className="mb-3 rounded-md bg-zinc-100 px-2.5 py-1.5 text-xs font-medium text-zinc-600">
          Editing shared template (all physicians)
        </div>
      )}

      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`subject-${index}`} className="text-xs text-zinc-600">
            Subject
          </Label>
          <Input
            id={`subject-${index}`}
            value={subjectValue}
            onChange={(e) => handleSubjectChange(e.target.value)}
            onFocus={onActivate}
            placeholder="e.g. Introduction — {{specialty}} collaboration"
          />
          {/* Shared-template validation still applies even while viewing an override. */}
          {errors?.subjectTemplate && (
            <p className="text-xs text-destructive">
              Shared template: {errors.subjectTemplate.message}
            </p>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <Label className="text-xs text-zinc-600">Body</Label>

          {/* Variable chips only make sense for the shared template — an override is sent verbatim. */}
          {!isOverrideMode && (
            <div className="flex flex-wrap gap-1.5">
              {TEMPLATE_VARIABLES.map((variable) => (
                <button
                  key={variable}
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => insertVariable(variable)}
                  className="rounded-md border border-zinc-200 bg-zinc-50 px-1.5 py-0.5 font-mono text-xs text-zinc-600 transition-colors hover:border-teal-700 hover:text-teal-700"
                >
                  {`{{${variable}}}`}
                </button>
              ))}
            </div>
          )}

          <Textarea
            ref={bodyRef}
            value={bodyValue}
            onChange={(e) => handleBodyChange(e.target.value)}
            rows={6}
            onFocus={onActivate}
            placeholder="Write the message, or generate a starting draft with AI."
          />
          {errors?.bodyTemplate && (
            <p className="text-xs text-destructive">Shared template: {errors.bodyTemplate.message}</p>
          )}
        </div>

        {/* "Generate with AI" only writes the shared template, so hide it while editing an override. */}
        {!isOverrideMode && (
          <div className="flex flex-col gap-1">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={generateWithAI}
              disabled={generating}
              className="w-fit"
            >
              {generating ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Sparkles className="size-3.5" />
              )}
              Generate with AI
            </Button>
            <p className="text-xs text-zinc-400">
              AI generates a starting draft. Final emails are personalized per physician at launch.
            </p>
          </div>
        )}

        {/* Per-physician personalization: instruction + generate. Shown whenever a physician is picked. */}
        <div
          className={cn(
            "flex flex-col gap-2 rounded-lg border p-3",
            isOverrideMode ? "border-teal-700/30 bg-teal-700/5" : "border-zinc-200 bg-zinc-50",
          )}
        >
          <Label htmlFor={`instruction-${index}`} className="text-xs text-zinc-600">
            Personalization context for{" "}
            {previewPhysician ? `Dr. ${previewPhysician.lastName}` : "the selected physician"}
          </Label>
          <Textarea
            id={`instruction-${index}`}
            rows={2}
            value={instruction}
            onChange={(e) => onInstructionChange(e.target.value)}
            disabled={!previewPhysician}
            placeholder="What's different for this physician? e.g. 'We met at ASCO 2025 and discussed her work on CAR-T trials.'"
            className="bg-white"
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={personalizeForPhysician}
            disabled={personalizing || !previewPhysician}
            className="w-fit"
          >
            {personalizing ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <UserPen className="size-3.5" />
            )}
            {isOverrideMode ? "Regenerate override" : "Personalize for selected physician"}
          </Button>
          <p className="text-xs text-zinc-400">
            Most physicians use the shared template above. Use this to write a custom version for the
            physician currently selected in the preview.
          </p>
        </div>
      </div>
    </div>
  );
}
