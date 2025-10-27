//hype-hire/vercel/components/AppSidebar.tsx
"use client";

import { ChevronDown } from "lucide-react";
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
import { cn } from "@/lib/utils";
import { useActiveRole } from "@/app/hooks/useActiveRole";
import { NAV_ITEMS, type NavItem } from "@/lib/dash-navigation";

export function AppSidebar() {
  const { t } = useTranslation("sidebar");
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const pathname = usePathname();
  const { activeRole, availableRoles, setActiveRole, hasPermission } =
    useActiveRole();
  const [isRoleSwitcherOpen, setIsRoleSwitcherOpen] = useState(false);

  // Memoized: Strip language from pathname ONCE
  const pathWithoutLang = useMemo(() => {
    return pathname.replace(/^\/[^/]+/, "");
  }, [pathname]);

  // Memoized: Filter and group navigation items by section
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

  // Memoized: Other roles for dropdown
  const otherRoles = useMemo(() => {
    return availableRoles.filter((r) => r.id !== activeRole?.id);
  }, [availableRoles, activeRole?.id]);

  // Memoized: Check if path is active
  const isActive = useCallback(
    (path: string) => {
      if (path === "/dashboard") {
        return pathWithoutLang === "/dashboard";
      }
      return pathWithoutLang === path || pathWithoutLang.startsWith(path + "/");
    },
    [pathWithoutLang]
  );

  // Memoized: Get navigation link classes
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

  // Safety check
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
        {/* Company/Role Switcher */}
        {!collapsed && (
          <div className="p-4 border-b">
            <button
              onClick={() => setIsRoleSwitcherOpen(!isRoleSwitcherOpen)}
              className="w-full flex items-center justify-between p-3 rounded-lg bg-secondary hover:bg-secondary/80 transition-colors"
            >
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-gradient-to-br from-pulse-500 to-pulse-600 rounded-lg flex items-center justify-center text-white font-bold text-sm">
                  {activeRole.companyName[0]}
                </div>
                <div className="text-left">
                  <div className="text-sm font-semibold">
                    {activeRole.companyName}
                  </div>
                  <div className="text-xs text-muted-foreground capitalize">
                    {activeRole.role}
                  </div>
                </div>
              </div>
              <ChevronDown
                className={cn(
                  "w-4 h-4 transition-transform",
                  isRoleSwitcherOpen && "rotate-180"
                )}
              />
            </button>

            {/* Role Dropdown */}
            {isRoleSwitcherOpen && otherRoles.length > 0 && (
              <div className="mt-2 space-y-1">
                {otherRoles.map((role) => (
                  <button
                    key={role.id}
                    onClick={() => {
                      setActiveRole(role.id);
                      setIsRoleSwitcherOpen(false);
                    }}
                    className="w-full flex items-center gap-2 p-2 rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <div className="w-6 h-6 rounded bg-muted flex items-center justify-center text-xs font-medium">
                      {role.companyName[0]}
                    </div>
                    <div className="text-left">
                      <div className="text-sm font-medium">
                        {role.companyName}
                      </div>
                      <div className="text-xs text-muted-foreground capitalize">
                        {role.role}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
        {/* Quick Create Button 
        <div className="p-4 flex justify-center">
          <Button
            className="w-[80%] bg-pulse-500 hover:bg-pulse-600 transition-all duration-200"
            size={collapsed ? "icon" : "default"}
          >
            <Plus className="w-4 h-4" />
            {!collapsed && <span className="ml-2">Quick Create</span>}
          </Button>
        </div> */}

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

        
