"use client";

import { ReactNode } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { useTranslation } from "react-i18next";

interface LayoutProps {
  children: ReactNode;
}

export default function JobsLayout({ children }: LayoutProps) {
  const { t, ready } = useTranslation("jobs");
  const pathname = usePathname();
  const lang = pathname.split("/")[1];

  const isJobs = pathname.includes("/jobs");
  const jobsPath = `/${lang}/dashboard/calendar/jobs`;
  const calendarPath = `/${lang}/dashboard/calendar`;

  if (!ready) {
    return (
      <div className="space-y-6 py-20">
        <div className="flex items-center justify-center min-h-[100px]">
          <div className="w-8 h-8 border-2 border-pulse-500 border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 py-16">
      {/* Tabs */}
      <div className="flex gap-2 border-b">
        <Link
          href={calendarPath}
          className={`px-4 py-2 font-medium transition-colors ${
            !isJobs
              ? "text-pulse-500 border-b-2 border-pulse-500"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {t("tabs.calendar")}
        </Link>
        <Link
          href={jobsPath}
          className={`px-4 py-2 font-medium transition-colors ${
            isJobs
              ? "text-pulse-500 border-b-2 border-pulse-500"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {t("tabs.job_management")}
        </Link>
      </div>

      {/* Page content */}
      {children}
    </div>
  );
}
