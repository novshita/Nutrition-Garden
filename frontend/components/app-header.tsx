"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { NAV_ITEMS } from "@/lib/nav";

export function AppHeader({ onSignOut }: { onSignOut: () => void }) {
  return (
    <header className="flex flex-wrap items-center justify-between gap-3">
      <Link href="/" className="font-diary text-3xl text-primary">
        🌷 Nutrition Garden
      </Link>
      <nav aria-label="Main" className="flex items-center gap-2">
        {NAV_ITEMS.map((item) => (
          <Link key={item.href} href={item.href} className="text-sm font-medium hover:underline">
            {item.label}
          </Link>
        ))}
        <Button variant="outline" onClick={onSignOut}>
          Sign out
        </Button>
      </nav>
    </header>
  );
}
