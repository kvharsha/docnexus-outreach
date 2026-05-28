import { listPhysicianFilterOptions, listPhysicians } from "@/lib/services/physicians";
import { physicianQuerySchema } from "@/lib/validators/physicians";
import { FilterSidebar } from "@/components/physicians/filter-sidebar";
import { PhysicianCard } from "@/components/physicians/physician-card";
import { SelectionBar } from "@/components/physicians/selection-bar";
import { SelectionProvider } from "@/components/physicians/selection-provider";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function PhysiciansPage({ searchParams }: { searchParams: SearchParams }) {
  const raw = await searchParams;

  // Keep only non-empty single-value params, then let zod coerce/validate. Bad input falls back
  // to defaults rather than erroring — a malformed URL shouldn't blank the whole page.
  const params: Record<string, string> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (typeof value === "string" && value !== "") params[key] = value;
  }
  const parsed = physicianQuerySchema.safeParse(params);
  const query = parsed.success ? parsed.data : physicianQuerySchema.parse({});

  const [{ data, total }, options] = await Promise.all([
    listPhysicians(query),
    listPhysicianFilterOptions(),
  ]);

  return (
    <div className="flex flex-1">
      <FilterSidebar options={options} />

      <SelectionProvider>
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex-1 px-8 py-6">
            <header className="pb-5">
              <h1 className="text-lg font-semibold text-zinc-950">Physicians</h1>
              <p className="text-sm text-zinc-600">
                Find and select physicians to enroll in an outreach campaign.
              </p>
            </header>

            {data.length === 0 ? (
              <div className="rounded-lg border border-dashed border-zinc-300 bg-white px-6 py-16 text-center">
                <p className="text-sm font-medium text-zinc-950">No physicians match these filters</p>
                <p className="mt-1 text-sm text-zinc-600">
                  Try clearing a filter or widening the years-of-experience range.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
                {data.map((physician) => (
                  <PhysicianCard key={physician.id} physician={physician} />
                ))}
              </div>
            )}
          </div>

          <SelectionBar shown={data.length} total={total} />
        </div>
      </SelectionProvider>
    </div>
  );
}
