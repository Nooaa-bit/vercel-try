//hype-hire/vercel/app/[lang]/dashboard/calendar/layout.tsx
"use client";

import { ReactNode } from "react";
import { usePathname } from "next/navigation";                    //Hook to get the current URL path (e.g., "/en/dashboard/calendar")
import Link from "next/link";                                     //Component for client-side navigation between pages without full page reload      
import { useTranslation } from "react-i18next";
import { useActiveRole } from "@/app/hooks/useActiveRole";

interface LayoutProps {
  children: ReactNode;                                            //this layout wraps other pages/components
}
const TABS_TOP_OFFSET = 134;                                      // e.g. 56px for the navbar + 16px space

export default function JobsLayout({ children }: LayoutProps) {
  const { t, ready } = useTranslation("jobs");
  const pathname = usePathname();
  const lang = pathname.split("/")[1];
  const { hasPermission, loading: roleLoading } = useActiveRole();

  const isJobs = pathname.includes("/jobs");
  const jobsPath = `/${lang}/dashboard/calendar/jobs`;
  const calendarPath = `/${lang}/dashboard/calendar`;

  // Check if user has admin access
  const isAdmin = hasPermission("company_admin");
  /* Option 2: More explicit (same result)
  const { hasAnyRole } = useActiveRole();
  const isAdmin = hasAnyRole(["company_admin", "superadmin"]);
 Option 3: Use the pre-computed flag
  const { isSuperAdmin, activeRole } = useActiveRole();
  const isAdmin = isSuperAdmin || activeRole?.role === "company_admin";*/

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
      <div
        className="flex gap-2 border-b bg-background sticky py-1 "
        style={{ top: TABS_TOP_OFFSET, zIndex: 20 }}
      >
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
