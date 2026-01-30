// app/[lang]/dashboard/calendar/loading.tsx
"use client";

import { usePathname } from "next/navigation";
import { Loader2 } from "lucide-react";

const messages = {
  en: {
    title: "Loading calendar...",
    subtitle: "Fetching your shifts and schedule",
  },
  el: {
    title: "Φόρτωση ημερολογίου...",
    subtitle: "Ανάκτηση των βαρδιών και του προγράμματός σας",
  },
};

export default function Loading() {
  const pathname = usePathname();
  const lang = pathname.split("/")[1] as "en" | "el";
  const text = messages[lang] || messages.en;

  return (
    <div className="w-full space-y-4 py-0">
      {/* Top row skeleton */}
      <div className="grid grid-cols-3 gap-4">
        <div className="h-20 bg-muted/50 animate-pulse rounded-lg" />
        <div className="h-20 bg-muted/50 animate-pulse rounded-lg" />
        <div className="h-20 bg-muted/50 animate-pulse rounded-lg" />
      </div>

      {/* Calendar skeleton with loading indicator */}
      <div className="rounded-lg border bg-card p-12">
        <div className="flex flex-col items-center justify-center gap-4">
          <Loader2 className="w-8 h-8 text-primary animate-spin" />
          <div className="text-center space-y-2">
            <p className="text-sm font-medium">{text.title}</p>
            <p className="text-xs text-muted-foreground">{text.subtitle}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
