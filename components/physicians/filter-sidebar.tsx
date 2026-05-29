"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import type { PhysicianFilterOptions } from "@/lib/services/physicians";
import { PHYSICIAN_FILTER_KEYS } from "@/lib/validators/physicians";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// Radix Select can't hold an empty string value, so "all" stands in for "no filter on this field".
const ALL = "all";
const SEARCH_DEBOUNCE_MS = 350;

type Props = { options: PhysicianFilterOptions };

export function FilterSidebar({ options }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Free-text inputs are debounced, so they need local state; the selects read straight from the URL.
  const [search, setSearch] = useState(searchParams.get("search") ?? "");
  const [minYears, setMinYears] = useState(searchParams.get("minYearsExperience") ?? "");

  // Writing a filter always resets to page 1 — staying on page 3 of the old result set makes no sense.
  const commitParam = useCallback(
    (key: string, value: string | null) => {
      const next = new URLSearchParams(searchParams);
      if (value) next.set(key, value);
      else next.delete(key);
      next.delete("page");
      router.push(`${pathname}?${next.toString()}`);
    },
    [router, pathname, searchParams],
  );

  // Debounce the two text fields so we don't fire a navigation on every keystroke.
  useEffect(() => {
    const current = searchParams.get("search") ?? "";
    if (search === current) return;
    const t = setTimeout(() => commitParam("search", search || null), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [search, searchParams, commitParam]);

  useEffect(() => {
    const current = searchParams.get("minYearsExperience") ?? "";
    if (minYears === current) return;
    const t = setTimeout(() => commitParam("minYearsExperience", minYears || null), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [minYears, searchParams, commitParam]);

  const dropdowns: { key: string; label: string; values: string[] }[] = [
    { key: "specialty", label: "Specialty", values: options.specialties },
    { key: "subSpecialty", label: "Sub-specialty", values: options.subSpecialties },
    { key: "state", label: "State", values: options.states },
    { key: "affiliation", label: "Affiliation", values: options.affiliations },
  ];

  // Reflect the committed URL state, not the debounced local inputs, so the button matches reality.
  const hasActiveFilter = PHYSICIAN_FILTER_KEYS.some((key) => searchParams.get(key));

  const clearAll = () => {
    setSearch("");
    setMinYears("");
    router.push(pathname);
  };

  return (
    <aside className="sticky top-0 h-fit w-70 shrink-0 border-r border-zinc-200 bg-white p-5">
      <div className="flex items-center justify-between pb-4">
        <h2 className="text-sm font-semibold text-zinc-950">Filters</h2>
        {hasActiveFilter && (
          <button
            type="button"
            onClick={clearAll}
            className="text-xs text-zinc-500 transition-colors hover:text-zinc-950"
          >
            Clear all filters
          </button>
        )}
      </div>

      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="search" className="text-xs text-zinc-600">
            Search by name
          </Label>
          <Input
            id="search"
            placeholder="First or last name"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {dropdowns.map(({ key, label, values }) => {
          const current = searchParams.get(key) ?? ALL;
          return (
            <div key={key} className="flex flex-col gap-1.5">
              <Label className="text-xs text-zinc-600">{label}</Label>
              <Select
                value={current}
                onValueChange={(v) => commitParam(key, v === ALL ? null : v)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={`All ${label.toLowerCase()}`} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>All {label.toLowerCase()}</SelectItem>
                  {values.map((v) => (
                    <SelectItem key={v} value={v}>
                      {v}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          );
        })}

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="minYears" className="text-xs text-zinc-600">
            Min. years of experience
          </Label>
          <Input
            id="minYears"
            type="number"
            min={0}
            placeholder="Any"
            value={minYears}
            onChange={(e) => setMinYears(e.target.value)}
            className="tabular-nums"
          />
        </div>
      </div>
    </aside>
  );
}
