//hype-hire/vercel/app/[lang]/dashboard/calendar/layout.tsx
"use client";

import { ReactNode } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { useTranslation } from "react-i18next";
import { useActiveRole } from "@/app/hooks/useActiveRole";

interface LayoutProps {
  children: ReactNode;
}

export default function JobsLayout({ children }: LayoutProps) {
  const { t, ready } = useTranslation("jobs");
  const pathname = usePathname();
  const lang = pathname.split("/")[1];
  const { activeRole, loading: roleLoading } = useActiveRole();

  const isJobs = pathname.includes("/jobs");
  const jobsPath = `/${lang}/dashboard/calendar/jobs`;
  const calendarPath = `/${lang}/dashboard/calendar`;

  // ✅ Check if user has admin access
  const isAdmin =
    activeRole?.role === "company_admin" || activeRole?.role === "superadmin";
  
    //Show a spinning loader, until Role is loaded
  if (!ready || roleLoading) {
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
      {/* ✅ Tabs - Only show Job Management for admins */}
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

        {/* ✅ Only render Job Management tab if user is admin */}
        {isAdmin && (
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
        )}
      </div>

      {/* Page content */}
      {children}
    </div>
  );
}
