//hype-hire/vercel/app/[lang]/dashboard/layout.tsx
"use client";

import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  SidebarProvider,
  SidebarTrigger,
  SidebarInset,
} from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { usePathname } from "next/navigation";
import { ActiveRoleProvider, useActiveRole } from "../../hooks/useActiveRole";
import { useAuth } from "../../hooks/useAuth";
import { NAV_ITEMS } from "@/lib/dash-navigation";

function DashboardContent({ children }: { children: React.ReactNode }) {
  const { t } = useTranslation("dash-layout");
  const { t: tSidebar } = useTranslation("sidebar");
  const { user, profile, loading } = useAuth();
  const {
    activeRole,
    isSuperAdmin,
    selectedCompanyForAdmin,
    availableCompanies,
  } = useActiveRole();
  const pathname = usePathname();

  // Finds which sidebar item matches current page → Shows title in header. Memoized to avoid recalculating on every render
  const currentTitle = useMemo(() => {
    const pathWithoutLang = pathname?.replace(/^\/[^/]+/, "") || "";
    const currentItem = NAV_ITEMS.find((item) => {
      if (item.url === "/dashboard" && pathWithoutLang === "/dashboard")
        return true;
      if (item.url !== "/dashboard" && pathWithoutLang.startsWith(item.url))
        return true;
      return false;
    });
    return currentItem ? tSidebar(currentItem.titleKey) : tSidebar("dashboard");
  }, [pathname, tSidebar]);

  // ✅ Memoized company name display - shows selected company for superadmins
  const displayCompanyName = useMemo(() => {
    if (isSuperAdmin && selectedCompanyForAdmin) {
      const selectedCompany = availableCompanies.find(
        (c) => c.id === selectedCompanyForAdmin,
      );
      return selectedCompany?.name || activeRole.companyName;
    }
    return activeRole.companyName;
  }, [
    isSuperAdmin,
    selectedCompanyForAdmin,
    availableCompanies,
    activeRole.companyName,
  ]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-pulse-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  // Display name priority: profile.firstName > user_metadata > email
  const displayName =
    profile?.firstName || user?.user_metadata?.first_name || user?.email;

  return (
    <div>
      <SidebarProvider>             {/* shadcn context */}
        <div className="min-h-screen flex w-full bg-background">
          <AppSidebar user={user} />        {/* Left sidebar with nav */}
          <SidebarInset className="flex-1">       {/* Main content area */}
            <header className="h-14 border-b bg-card flex items-center justify-between px-4 shadow-sm sticky top-20 z-30"> {/* Top-20 = below Navbar */}
              <div className="flex items-center gap-2">
                <SidebarTrigger className="mr-2" /> {/* Hamburger mobile */}
                <h1 className="text-lg font-semibold">{currentTitle}</h1>
                <span className="text-lg text-muted-foreground hidden sm:block">
                  {displayCompanyName} {/* Shows selected company for superadmins, activeRole company for others */}
                </span>
              </div>
              <div className="flex items-center gap-2 p-2">
                <span className="text-sm font-medium hidden sm:block">
                  {t("welcome")} {displayName} {/* "Welcome John" */}
                </span>
              </div>
            </header>
            <main className="flex-1 p-6">{children}</main> {/* Actual page content (dashboard/page.tsx) */}
          </SidebarInset>
        </div>
      </SidebarProvider>
    </div>
  );
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ActiveRoleProvider> {/* Provides activeRole to all pages */}
      <DashboardContent>{children}</DashboardContent>
    </ActiveRoleProvider>
  );
}

/*
DashboardLayout (wrapper)
  └── ActiveRoleProvider (context)
       └── DashboardContent (actual UI)
            ├── Sidebar (collapsible menu)
            └── Main content area (children)

┌────────────────────────────────────────────┐
│ Navbar (global, from root layout)         │ ← Fixed top-0
├─────────┬──────────────────────────────────┤
│ Sidebar │ Header: Calendar | Hype Hire    │ ← Sticky top-20
│         │ Welcome John                     │
│ - Home  ├──────────────────────────────────┤
│ - Cal   │                                  │
│ - Team  │ {children} ← Page content        │
│         │                                  │
└─────────┴──────────────────────────────────┘

*/
