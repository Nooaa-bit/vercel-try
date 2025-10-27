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
  const { activeRole } = useActiveRole();
  const pathname = usePathname();

  // Memoized to avoid recalculating on every render
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
      <SidebarProvider>
        <div className="min-h-screen flex w-full bg-background">
          <AppSidebar  />
          <SidebarInset className="flex-1">
            <header className="h-14 border-b bg-card flex items-center justify-between px-4 shadow-sm sticky top-20 z-30">
              <div className="flex items-center gap-2">
                <SidebarTrigger className="mr-2" />
                <h1 className="text-lg font-semibold">{currentTitle}</h1>
                <span className="text-lg text-muted-foreground hidden sm:block">
                  {activeRole.companyName}
                </span>
              </div>
              <div className="flex items-center gap-2 p-2">
                <span className="text-sm font-medium hidden sm:block">
                  {t("welcome")} {displayName}
                </span>
              </div>
            </header>
            <main className="flex-1 p-6">{children}</main>
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
    <ActiveRoleProvider>
      <DashboardContent>{children}</DashboardContent>
    </ActiveRoleProvider>
  );
}
