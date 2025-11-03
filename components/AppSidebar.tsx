"use client";

import { ChevronDown, Search, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useMemo, useCallback } from "react";
import { useTranslation } from "react-i18next";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useActiveRole } from "@/app/hooks/useActiveRole";
import { NAV_ITEMS, type NavItem } from "@/lib/dash-navigation";
import { User } from "@supabase/supabase-js";

interface AppSidebarProps {
  user: User | null;
}

export function AppSidebar({ user }: AppSidebarProps) {
  const { t } = useTranslation("sidebar");
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const pathname = usePathname();
  const {
    activeRole,
    availableRoles,
    setActiveRole,
    hasPermission,
    isSuperAdmin,
    availableCompanies,
    selectedCompanyForAdmin,
    setSelectedCompanyForAdmin,
  } = useActiveRole();

  const [isSwitcherOpen, setIsSwitcherOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const userEmail = user?.email || "";

  const pathWithoutLang = useMemo(() => {
    return pathname.replace(/^\/[^/]+/, "");
  }, [pathname]);

  const filteredItems = useMemo(() => {
    const sections = {
      main: [] as NavItem[],
      documents: [] as NavItem[],
      bottom: [] as NavItem[],
    };

    NAV_ITEMS.forEach((item) => {
      if (item.requiredRole && !hasPermission(item.requiredRole)) {
        return;
      }
      sections[item.section].push(item);
    });

    return sections;
  }, [hasPermission]);

  // ✅ For superadmins: show companies; for others: show roles
  const switcherItems = useMemo(() => {
    if (isSuperAdmin) {
      // Filter companies by search query
      return availableCompanies.filter((c) =>
        c.name.toLowerCase().includes(searchQuery.toLowerCase())
      );
    } else {
      // Show other roles
      return availableRoles.filter((r) => r.id !== activeRole?.id);
    }
  }, [
    isSuperAdmin,
    availableCompanies,
    availableRoles,
    activeRole?.id,
    searchQuery,
  ]);

  // ✅ Get selected company name for display
  const selectedCompanyName = useMemo(() => {
    if (isSuperAdmin) {
      return availableCompanies.find((c) => c.id === selectedCompanyForAdmin)
        ?.name;
    }
    return null;
  }, [isSuperAdmin, availableCompanies, selectedCompanyForAdmin]);

  const isActive = useCallback(
    (path: string) => {
      if (path === "/dashboard") {
        return pathWithoutLang === "/dashboard";
      }
      return pathWithoutLang === path || pathWithoutLang.startsWith(path + "/");
    },
    [pathWithoutLang]
  );

  const getNavClass = useCallback(
    (path: string) => {
      return cn(
        "w-full justify-start transition-all duration-200",
        isActive(path)
          ? "bg-pulse-500 text-white shadow-sm font-medium"
          : "hover:bg-secondary text-muted-foreground hover:text-foreground"
      );
    },
    [isActive]
  );

  if (!activeRole) {
    return null;
  }

  return (
    <Sidebar
      className={cn(
        "border-r transition-all duration-300 mt-16 sm:mt-20",
        collapsed ? "w-14" : "w-64"
      )}
      style={{ height: "calc(100vh - 4rem)" }}
    >
      <SidebarContent className="bg-sidebar pb-4">
        {/* ✅ Unified Switcher: Roles for regular users, Companies for superadmins */}
        {!collapsed && (
          <div className="p-4 border-b">
            <button
              onClick={() => setIsSwitcherOpen(!isSwitcherOpen)}
              className="w-full flex items-center justify-between p-3 rounded-lg bg-secondary hover:bg-secondary/80 transition-colors"
            >
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-gradient-to-br from-pulse-500 to-pulse-600 rounded-lg flex items-center justify-center text-white font-bold text-sm">
                  {isSuperAdmin
                    ? selectedCompanyName?.[0] || "?"
                    : activeRole.companyName[0]}
                </div>
                <div className="text-left">
                  <div className="text-sm font-semibold">
                    {isSuperAdmin
                      ? selectedCompanyName || "Select Company"
                      : activeRole.companyName}
                  </div>
                  <div className="text-xs text-muted-foreground capitalize">
                    {t(`roles.${activeRole.role}`, {
                      defaultValue: activeRole.role
                        .replace("_", " ")
                        .toUpperCase(),
                    })}
                  </div>
                </div>
              </div>
              <ChevronDown
                className={cn(
                  "w-4 h-4 transition-transform",
                  isSwitcherOpen && "rotate-180"
                )}
              />
            </button>

            {/* ✅ Dropdown with Search for Superadmins */}
            {isSwitcherOpen && (
              <div className="mt-2 space-y-2">
                {/* Search input for superadmins */}
                {isSuperAdmin && availableCompanies.length > 0 && (
                  <div className="relative">
                    <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      placeholder="Search companies..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-8 pr-8 h-8 text-sm"
                      autoFocus
                    />
                    {searchQuery && (
                      <button
                        onClick={() => setSearchQuery("")}
                        className="absolute right-2 top-1/2 transform -translate-y-1/2"
                      >
                        <X className="w-4 h-4 text-muted-foreground hover:text-foreground" />
                      </button>
                    )}
                  </div>
                )}

                {/* Items list */}
                <div className="space-y-1 max-h-48 overflow-y-auto">
                  {switcherItems.length === 0 ? (
                    <div className="p-2 text-xs text-muted-foreground text-center">
                      {isSuperAdmin ? "No companies found" : "No other roles"}
                    </div>
                  ) : (
                    switcherItems.map((item) => {
                      // Determine if this is a company or role
                      const isCompany =
                        "name" in item && !("companyName" in item);
                      const itemId = isCompany ? item.id : item.id;
                      const isSelected = isSuperAdmin
                        ? selectedCompanyForAdmin === item.id
                        : activeRole?.id === item.id;

                      return (
                        <button
                          key={itemId}
                          onClick={() => {
                            if (isSuperAdmin) {
                              setSelectedCompanyForAdmin(item.id);
                            } else {
                              setActiveRole(item.id);
                            }
                            setIsSwitcherOpen(false);
                            setSearchQuery("");
                          }}
                          className={cn(
                            "w-full flex items-center gap-2 p-2 rounded-lg transition-colors",
                            isSelected
                              ? "bg-pulse-500/20 text-pulse-600 dark:text-pulse-400"
                              : "hover:bg-muted/50"
                          )}
                        >
                          <div className="w-6 h-6 rounded bg-muted flex items-center justify-center text-xs font-medium">
                            {isCompany ? item.name[0] : item.companyName[0]}
                          </div>
                          <div className="text-left flex-1">
                            <div className="text-sm font-medium">
                              {isCompany ? item.name : item.companyName}
                            </div>
                            {!isCompany && (
                              <div className="text-xs text-muted-foreground capitalize">
                                {t(`roles.${item.role}`, {
                                  defaultValue: item.role
                                    .replace("_", " ")
                                    .toUpperCase(),
                                })}
                              </div>
                            )}
                          </div>
                          {isSelected && (
                            <span className="text-pulse-600 dark:text-pulse-400">
                              ✓
                            </span>
                          )}
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Main Navigation */}
        <SidebarGroup>
          {!collapsed && <SidebarGroupLabel>{t("main")}</SidebarGroupLabel>}
          <SidebarGroupContent>
            <SidebarMenu>
              {filteredItems.main.map((item) => (
                <SidebarMenuItem key={item.titleKey}>
                  <SidebarMenuButton asChild>
                    <Link href={item.url} className={getNavClass(item.url)}>
                      <item.icon className="w-4 h-4" />
                      {!collapsed && <span>{t(item.titleKey)}</span>}
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Documents Navigation */}
        <SidebarGroup>
          {!collapsed && (
            <SidebarGroupLabel>{t("documents")}</SidebarGroupLabel>
          )}
          <SidebarGroupContent>
            <SidebarMenu>
              {filteredItems.documents.map((item) => (
                <SidebarMenuItem key={item.titleKey}>
                  <SidebarMenuButton asChild>
                    <Link href={item.url} className={getNavClass(item.url)}>
                      <item.icon className="w-4 h-4" />
                      {!collapsed && <span>{t(item.titleKey)}</span>}
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Bottom Navigation */}
        <div className="mt-auto">
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu>
                {filteredItems.bottom.map((item) => (
                  <SidebarMenuItem key={item.titleKey}>
                    <SidebarMenuButton asChild>
                      <Link href={item.url} className={getNavClass(item.url)}>
                        <item.icon className="w-4 h-4" />
                        {!collapsed && <span>{t(item.titleKey)}</span>}
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </div>
      </SidebarContent>
    </Sidebar>
  );
}
