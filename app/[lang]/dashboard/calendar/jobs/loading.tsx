// app/[lang]/dashboard/calendar/jobs/loading.tsx
"use client";

import { usePathname } from "next/navigation";
import { Loader2 } from "lucide-react";

const messages = {
  en: {
    title: "Loading jobs...",
    subtitle: "Fetching job listings and assignments",
  },
  el: {
    title: "Φόρτωση θέσεων εργασίας...",
    subtitle: "Ανάκτηση λίστας θέσεων και αναθέσεων",
  },
};

export default function Loading() {
  const pathname = usePathname();
  const lang = pathname.split("/")[1] as "en" | "el";
  const text = messages[lang] || messages.en;

  return (
    <div className="w-full space-y-8 py-2">
      {/* Top row skeleton - filters + stats */}
      <div className="grid grid-cols-4 gap-4">
        <div className="h-20 bg-muted/50 animate-pulse rounded-lg" />
        <div className="h-20 bg-muted/50 animate-pulse rounded-lg" />
        <div className="h-20 bg-muted/50 animate-pulse rounded-lg" />
        <div className="h-20 bg-muted/50 animate-pulse rounded-lg" />
      </div>

      {/* Jobs card skeleton with loading indicator */}
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
