import { Toaster } from "@/components/ui/sonner";
import { ComplianceFooter } from "@/components/shared/compliance-footer";
import { SidebarNav } from "@/components/shared/sidebar-nav";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-1">
      <aside className="sticky top-0 flex h-screen w-60 shrink-0 flex-col border-r border-zinc-200 bg-white px-4 py-5">
        <div className="flex items-center gap-1.5 px-2.5 pb-6">
          <span className="text-sm font-semibold tracking-wide text-zinc-950 tabular-nums uppercase">
            DocNexus
          </span>
          <span className="size-1.5 rounded-full bg-teal-700" />
        </div>
        <SidebarNav />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <main className="flex-1">{children}</main>
        <ComplianceFooter />
      </div>

      {/* Light-only app — pin the toaster to light so it never follows a dark OS theme. */}
      <Toaster theme="light" position="bottom-right" />
    </div>
  );
}
