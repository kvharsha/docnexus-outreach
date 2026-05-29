"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Controller, FormProvider, useFieldArray, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, ArrowRight, Loader2, Plus, Users } from "lucide-react";
import { toast } from "sonner";

import type { Physician } from "@/generated/prisma/client";
import { createCampaignSchema, type CreateCampaignInput } from "@/lib/validators/campaigns";
import { SELECTION_STORAGE_KEY } from "@/components/physicians/selection-provider";
import { BuilderStepper, type BuilderStep } from "@/components/campaigns/builder-stepper";
import { PreviewPanel } from "@/components/campaigns/preview-panel";
import { SequenceStepEditor } from "@/components/campaigns/sequence-step-editor";
import type { OverrideDraft, OverridesMap } from "@/components/campaigns/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

const CAMPAIGN_TYPES = [
  {
    value: "cold_outbound",
    label: "Cold Outbound",
    description: "First-touch outreach to physicians not previously contacted.",
  },
  {
    value: "reengagement",
    label: "Re-engagement",
    description: "Reach physicians who engaged in the past but have gone quiet.",
  },
  {
    value: "conference_followup",
    label: "Conference Follow-up",
    description: "Personalized follow-up to physicians met at a recent event.",
  },
] as const;

const DEFAULT_FOLLOWUP_DELAY_DAYS = 3;

function readStoredSelection(): string[] {
  const stored = sessionStorage.getItem(SELECTION_STORAGE_KEY);
  if (!stored) return [];
  try {
    const parsed: unknown = JSON.parse(stored);
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

export default function NewCampaignPage() {
  const router = useRouter();
  const [physicians, setPhysicians] = useState<Physician[]>([]);
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState<BuilderStep>(0);
  const [activeStepIndex, setActiveStepIndex] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  // The physician the preview is pointed at, and any custom overrides written so far. Overrides live
  // in memory until the campaign is created, then get persisted in one call.
  const [previewId, setPreviewId] = useState("");
  const [overrides, setOverrides] = useState<OverridesMap>({});
  // Per-physician-per-step instruction text. Drives override generation; intentionally NOT persisted
  // to the DB — it's an input to the AI, not part of the final email.
  const [instructions, setInstructions] = useState<Record<string, Record<number, string>>>({});

  const form = useForm<CreateCampaignInput>({
    resolver: zodResolver(createCampaignSchema),
    defaultValues: {
      name: "",
      type: "cold_outbound",
      sequences: [{ stepNumber: 1, delayDays: 0, subjectTemplate: "", bodyTemplate: "" }],
      physicianIds: [],
    },
  });

  const { fields, append, remove } = useFieldArray({ control: form.control, name: "sequences" });

  // Pull the selection from the discovery page, then hydrate it into real physician records.
  // The API has no by-id filter, but there are only a few dozen rows — one page covers them all.
  useEffect(() => {
    const ids = readStoredSelection();
    if (ids.length === 0) {
      setLoading(false);
      return;
    }

    fetch("/api/physicians?pageSize=100")
      .then((r) => r.json())
      .then((res: { data: Physician[] }) => {
        const selected = res.data.filter((p) => ids.includes(p.id));
        setPhysicians(selected);
        setPreviewId(selected[0]?.id ?? "");
        form.setValue("physicianIds", selected.map((p) => p.id));
      })
      .catch(() => toast.error("Couldn't load the selected physicians."))
      .finally(() => setLoading(false));
  }, [form]);

  const goNext = async () => {
    // Don't let someone reach Sequence with a nameless campaign, or Review with an empty step.
    if (step === 0) {
      const ok = await form.trigger(["name", "type"]);
      if (ok) setStep(1);
      return;
    }
    if (step === 1) {
      const ok = await form.trigger("sequences");
      if (ok) setStep(2);
    }
  };

  const saveOverride = (physicianId: string, stepNumber: number, draft: OverrideDraft) => {
    setOverrides((prev) => ({
      ...prev,
      [physicianId]: { ...prev[physicianId], [stepNumber]: draft },
    }));
  };

  const removeOverride = (physicianId: string, stepNumber: number) => {
    setOverrides((prev) => {
      const forPhysician = { ...prev[physicianId] };
      delete forPhysician[stepNumber];
      const next = { ...prev };
      // Drop the physician key entirely once their last override is gone, so indicators clear.
      if (Object.keys(forPhysician).length === 0) delete next[physicianId];
      else next[physicianId] = forPhysician;
      return next;
    });
  };

  const setInstruction = (physicianId: string, stepNumber: number, value: string) => {
    setInstructions((prev) => ({
      ...prev,
      [physicianId]: { ...prev[physicianId], [stepNumber]: value },
    }));
  };

  // Flatten the nested overrides map into the array shape the persist endpoint expects.
  const flattenOverrides = () =>
    Object.entries(overrides).flatMap(([physicianId, steps]) =>
      Object.entries(steps).map(([stepNumber, draft]) => ({
        physicianId,
        stepNumber: Number(stepNumber),
        subject: draft.subject,
        body: draft.body,
      })),
    );

  const submitCampaign = async (data: CreateCampaignInput, mode: "draft" | "launch") => {
    setSubmitting(true);
    try {
      // Renumber steps to a clean 1..N at submit, so removing a middle follow-up can't leave gaps.
      const payload = {
        ...data,
        sequences: data.sequences.map((s, i) => ({ ...s, stepNumber: i + 1 })),
      };

      const res = await fetch("/api/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        toast.error("Couldn't create the campaign. Check the form and try again.");
        return;
      }

      const campaign: { id: string } = await res.json();

      // Persist overrides (if any) before launching, so the drain can find them.
      const flatOverrides = flattenOverrides();
      if (flatOverrides.length > 0) {
        const ovRes = await fetch(`/api/campaigns/${campaign.id}/overrides`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ overrides: flatOverrides }),
        });
        if (!ovRes.ok) {
          toast.error("Campaign created, but saving personalized overrides failed.");
        }
      }

      if (mode === "launch") {
        const launchRes = await fetch(`/api/campaigns/${campaign.id}/launch`, { method: "PATCH" });
        if (launchRes.ok) {
          toast.success("Campaign launched — sends are draining now.");
        } else {
          // The campaign exists as a draft; surface the failure but still take them to the dashboard.
          toast.error("Campaign created, but launch failed. You can retry from the dashboard.");
        }
      } else {
        toast.success("Saved as draft.");
      }

      sessionStorage.removeItem(SELECTION_STORAGE_KEY);
      router.push(`/campaigns/${campaign.id}`);
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center py-32 text-zinc-400">
        <Loader2 className="size-5 animate-spin" />
      </div>
    );
  }

  if (physicians.length === 0) {
    return (
      <div className="px-8 py-16">
        <div className="mx-auto max-w-md rounded-lg border border-dashed border-zinc-300 bg-white px-6 py-16 text-center">
          <Users className="mx-auto size-6 text-zinc-400" />
          <p className="mt-3 text-sm font-medium text-zinc-950">No physicians selected</p>
          <p className="mt-1 text-sm text-zinc-600">
            Pick physicians on the discovery page before building a campaign.
          </p>
          <Button asChild size="sm" className="mt-4 bg-teal-700 text-white hover:bg-teal-700/90">
            <Link href="/physicians">Go to Physicians</Link>
          </Button>
        </div>
      </div>
    );
  }

  const sequences = form.watch("sequences");
  const selectedType = form.watch("type");
  const safeActiveIndex = Math.min(activeStepIndex, sequences.length - 1);
  const activeStep = sequences[safeActiveIndex] ?? sequences[0];
  const typeLabel = CAMPAIGN_TYPES.find((t) => t.value === selectedType)?.label ?? selectedType;
  const previewPhysician = physicians.find((p) => p.id === previewId);
  const overrideCount = flattenOverrides().length;

  return (
    <FormProvider {...form}>
      <div className="px-8 py-6">
        <header className="pb-5">
          <h1 className="text-lg font-semibold text-zinc-950">New campaign</h1>
          <p className="text-sm text-zinc-600">
            <span className="tabular-nums">{physicians.length}</span> physicians will be enrolled.
          </p>
        </header>

        <div className="pb-6">
          <BuilderStepper current={step} onStepClick={setStep} />
        </div>

        {step === 0 && (
          <div className="max-w-2xl flex-col gap-6">
            <div className="flex flex-col gap-1.5 pb-6">
              <Label htmlFor="name" className="text-xs text-zinc-600">
                Campaign name
              </Label>
              <Input id="name" placeholder="e.g. Q3 Oncology Outreach" {...form.register("name")} />
              {form.formState.errors.name && (
                <p className="text-xs text-destructive">{form.formState.errors.name.message}</p>
              )}
            </div>

            <div className="flex flex-col gap-2">
              <Label className="text-xs text-zinc-600">Campaign type</Label>
              <Controller
                control={form.control}
                name="type"
                render={({ field }) => (
                  <div className="grid gap-2">
                    {CAMPAIGN_TYPES.map((type) => {
                      const checked = field.value === type.value;
                      return (
                        <button
                          key={type.value}
                          type="button"
                          onClick={() => field.onChange(type.value)}
                          aria-pressed={checked}
                          className={cn(
                            "rounded-lg border bg-white p-3 text-left transition-colors",
                            checked
                              ? "border-teal-700 ring-1 ring-teal-700"
                              : "border-zinc-200 hover:border-zinc-300",
                          )}
                        >
                          <p className="text-sm font-medium text-zinc-950">{type.label}</p>
                          <p className="mt-0.5 text-xs text-zinc-600">{type.description}</p>
                        </button>
                      );
                    })}
                  </div>
                )}
              />
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="flex gap-6">
            <div className="flex min-w-0 flex-1 flex-col gap-3">
              {fields.map((fieldItem, index) => {
                const stepNum = index + 1;
                const physicianOverride = previewPhysician
                  ? overrides[previewPhysician.id]?.[stepNum]
                  : undefined;
                const physicianInstruction = previewPhysician
                  ? (instructions[previewPhysician.id]?.[stepNum] ?? "")
                  : "";
                return (
                  <SequenceStepEditor
                    key={fieldItem.id}
                    index={index}
                    isFirst={index === 0}
                    onRemove={() => remove(index)}
                    onActivate={() => setActiveStepIndex(index)}
                    previewPhysician={previewPhysician}
                    override={physicianOverride}
                    instruction={physicianInstruction}
                    onInstructionChange={(value) =>
                      previewPhysician && setInstruction(previewPhysician.id, stepNum, value)
                    }
                    onSaveOverride={saveOverride}
                    onRemoveOverride={removeOverride}
                  />
                );
              })}

              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-fit"
                onClick={() =>
                  append({
                    stepNumber: fields.length + 1,
                    delayDays: DEFAULT_FOLLOWUP_DELAY_DAYS,
                    subjectTemplate: "",
                    bodyTemplate: "",
                  })
                }
              >
                <Plus className="size-3.5" />
                Add follow-up step
              </Button>

              {/* The schema's "step 1 needs delay 0" rule lands here as a generic sequences error. */}
              {typeof form.formState.errors.sequences?.message === "string" && (
                <p className="text-xs text-destructive">{form.formState.errors.sequences.message}</p>
              )}
            </div>

            {activeStep && (
              <PreviewPanel
                physicians={physicians}
                subject={activeStep.subjectTemplate}
                body={activeStep.bodyTemplate}
                stepNumber={safeActiveIndex + 1}
                previewId={previewId}
                onPreviewIdChange={setPreviewId}
                overrides={overrides}
                onRemoveOverride={removeOverride}
              />
            )}
          </div>
        )}

        {step === 2 && (
          <div className="max-w-2xl">
            <div className="rounded-lg border border-zinc-200 bg-white p-5">
              <h2 className="pb-4 text-sm font-medium text-zinc-950">Review</h2>
              <dl className="grid grid-cols-2 gap-y-3 text-sm">
                <dt className="text-zinc-600">Name</dt>
                <dd className="text-zinc-950">{form.watch("name")}</dd>
                <dt className="text-zinc-600">Type</dt>
                <dd className="text-zinc-950">{typeLabel}</dd>
                <dt className="text-zinc-600">Sequence steps</dt>
                <dd className="text-zinc-950 tabular-nums">{sequences.length}</dd>
                <dt className="text-zinc-600">Physicians enrolled</dt>
                <dd className="text-zinc-950 tabular-nums">{physicians.length}</dd>
                <dt className="text-zinc-600">Personalized overrides</dt>
                <dd className="text-zinc-950 tabular-nums">{overrideCount}</dd>
              </dl>
            </div>

            {/* Recipient list so the user can eyeball exactly who gets this before sending. */}
            <div className="mt-4 rounded-lg border border-zinc-200 bg-white">
              <div className="border-b border-zinc-200 px-4 py-2.5">
                <h3 className="text-sm font-medium text-zinc-950">Recipients</h3>
              </div>
              <ul className="max-h-60 divide-y divide-zinc-100 overflow-y-auto">
                {physicians.map((p) => {
                  const isPersonalized = Boolean(overrides[p.id]);
                  return (
                    <li key={p.id} className="flex items-center justify-between gap-3 px-4 py-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm text-zinc-950">
                          Dr. {p.firstName} {p.lastName}
                        </p>
                        <p className="truncate text-xs text-zinc-500">
                          {p.specialty} · {p.affiliation}
                        </p>
                      </div>
                      {isPersonalized && (
                        <span className="flex shrink-0 items-center gap-1 text-xs font-medium text-teal-700">
                          <span className="size-1.5 rounded-full bg-teal-700" />
                          Personalized
                        </span>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>

            <div className="mt-4 flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={submitting}
                onClick={form.handleSubmit((d) => submitCampaign(d, "draft"))}
              >
                Save as Draft
              </Button>
              <Button
                type="button"
                disabled={submitting}
                className="bg-teal-700 text-white hover:bg-teal-700/90"
                onClick={form.handleSubmit((d) => submitCampaign(d, "launch"))}
              >
                {submitting && <Loader2 className="size-4 animate-spin" />}
                Launch Campaign
              </Button>
            </div>
          </div>
        )}

        {/* Step navigation: Review has its own action buttons, so the footer only shows on 0 and 1. */}
        {step < 2 && (
          <div className="mt-6 flex items-center justify-between border-t border-zinc-200 pt-4">
            <Button
              type="button"
              variant="ghost"
              disabled={step === 0}
              onClick={() => setStep((s) => (s > 0 ? ((s - 1) as BuilderStep) : s))}
            >
              <ArrowLeft className="size-4" />
              Back
            </Button>
            <Button
              type="button"
              className="bg-teal-700 text-white hover:bg-teal-700/90"
              onClick={goNext}
            >
              Continue
              <ArrowRight className="size-4" />
            </Button>
          </div>
        )}
      </div>
    </FormProvider>
  );
}
