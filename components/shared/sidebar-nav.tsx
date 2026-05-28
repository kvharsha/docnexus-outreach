"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Megaphone, Users } from "lucide-react";

import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/physicians", label: "Physicians", icon: Users },
  { href: "/campaigns", label: "Campaigns", icon: Megaphone },
];

export function SidebarNav() {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-0.5">
      {NAV_ITEMS.map((item) => {
        // Highlight the section the user is in, including its sub-routes (e.g. /campaigns/new).
        const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
        const Icon = item.icon;

        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors",
              isActive
                ? "bg-zinc-200/70 text-zinc-950"
                : "text-zinc-600 hover:bg-zinc-200/50 hover:text-zinc-950",
            )}
          >
            <Icon className="size-4" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
