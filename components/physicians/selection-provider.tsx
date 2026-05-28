"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";

// Shared with the campaign builder — it reads this same key out of sessionStorage to pick up
// whatever was selected on the discovery page.
export const SELECTION_STORAGE_KEY = "docnexus.selectedPhysicianIds";

type SelectionContextValue = {
  selectedIds: string[];
  isSelected: (id: string) => boolean;
  toggle: (id: string) => void;
  clear: () => void;
  count: number;
};

const SelectionContext = createContext<SelectionContextValue | null>(null);

export function SelectionProvider({ children }: { children: React.ReactNode }) {
  // Start empty so server and first client render agree; the stored selection loads in after mount.
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const stored = sessionStorage.getItem(SELECTION_STORAGE_KEY);
    if (stored) {
      try {
        const parsed: unknown = JSON.parse(stored);
        if (Array.isArray(parsed)) setSelectedIds(parsed.filter((x): x is string => typeof x === "string"));
      } catch {
        // Corrupt value (hand-edited storage, version skew) — just ignore it and start clean.
      }
    }
    setHydrated(true);
  }, []);

  // Only persist after the initial read, otherwise the empty default would clobber stored IDs.
  useEffect(() => {
    if (!hydrated) return;
    sessionStorage.setItem(SELECTION_STORAGE_KEY, JSON.stringify(selectedIds));
  }, [selectedIds, hydrated]);

  const isSelected = useCallback((id: string) => selectedIds.includes(id), [selectedIds]);

  const toggle = useCallback((id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }, []);

  const clear = useCallback(() => setSelectedIds([]), []);

  return (
    <SelectionContext.Provider
      value={{ selectedIds, isSelected, toggle, clear, count: selectedIds.length }}
    >
      {children}
    </SelectionContext.Provider>
  );
}

export function useSelection() {
  const ctx = useContext(SelectionContext);
  if (!ctx) throw new Error("useSelection must be used within a SelectionProvider");
  return ctx;
}
