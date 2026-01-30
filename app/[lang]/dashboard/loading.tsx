// app/[lang]/dashboard/loading.tsx

"use client";

import { usePathname } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

const messages = {
  en: {
    title: "Loading dashboard...",
    subtitle: "Fetching your shifts and invitations",
  },
  el: {
    title: "Φόρτωση πίνακα...",
    subtitle: "Ανάκτηση των βαρδιών και προσκλήσεών σας",
  },
};

export default function Loading() {
  const pathname = usePathname();
  const lang = pathname.split("/")[1] as "en" | "el";
  const text = messages[lang] || messages.en;

  return (
    <div className="space-y-6">
      {/* Loading Message */}
      <div className="flex flex-col items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
        <h2 className="text-lg font-semibold">{text.title}</h2>
        <p className="text-sm text-muted-foreground">{text.subtitle}</p>
      </div>

      {/* Skeleton Cards */}
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-32" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </CardContent>
      </Card>
    </div>
  );
}
