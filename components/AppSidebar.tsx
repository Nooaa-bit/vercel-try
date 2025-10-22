"use client";

import {
  LayoutDashboard,
  BarChart3,
  FileText,
  UserRoundPlus,
  Users,
  Calendar as CalendarIcon,
  Settings,
  HelpCircle,
  Search,
  ChevronDown,
  Building2,
  Plus,
  MapPinIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
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
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useActiveRole } from "@/app/hooks/useActiveRole";

interface AppSidebarProps {
  user?: {
    email?: string;
    user_metadata?: {
      first_name?: string;
      last_name?: string;
    };
  } | null;
}

type Role = "superadmin" | "company_admin" | "supervisor" | "talent";

interface NavItem {
  titleKey: string;
  url: string;
  icon: React.ComponentType<{ className?: string }>;
  requiredRole?: Role;
}

export function AppSidebar({ user }: AppSidebarProps) {
  const { t } = useTranslation("sidebar");
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const pathname = usePathname();
  const { activeRole, availableRoles, setActiveRole, hasPermission } =
    useActiveRole();
  const [isRoleSwitcherOpen, setIsRoleSwitcherOpen] = useState(false);

  // Define navigation items with translation keys
  const mainItems: NavItem[] = [
    { titleKey: "dashboard", url: "/dashboard", icon: LayoutDashboard },
    { titleKey: "calendar", url: "/dashboard/calendar", icon: CalendarIcon },
    {
      titleKey: "locations",
      url: "/dashboard/locations",
      icon: MapPinIcon,
      requiredRole: "company_admin",
    },
    { titleKey: "team", url: "/dashboard/team", icon: Users },
  ];

  const documentItems: NavItem[] = [
    {
      titleKey: "invitations",
      url: "/dashboard/invitations",
      icon: UserRoundPlus,
    },
    { titleKey: "analytics", url: "/dashboard/analytics", icon: BarChart3 },
    { titleKey: "contracts", url: "/dashboard/contracts", icon: FileText },
  ];

  const bottomItems: NavItem[] = [
    { titleKey: "settings", url: "/dashboard/settings", icon: Settings },
    { titleKey: "getHelp", url: "/dashboard/help", icon: HelpCircle },
    { titleKey: "search", url: "/dashboard/search", icon: Search },
  ];

  // Filter navigation items based on user permissions
  const filterByPermission = (items: NavItem[]) => {
    return items.filter((item) => {
      if (!item.requiredRole) return true;
      return hasPermission(item.requiredRole);
    });
  };

  const visibleMainItems = filterByPermission(mainItems);
  const visibleDocumentItems = filterByPermission(documentItems);
  const visibleBottomItems = filterByPermission(bottomItems);

  const isActive = (path: string) => {
    if (path === "/dashboard" && pathname === "/dashboard") return true;
    if (path !== "/dashboard" && pathname.startsWith(path)) return true;
    return false;
  };

  const getNavClass = (path: string) => {
    return cn(
      "w-full justify-start transition-all duration-200",
      isActive(path)
        ? "bg-pulse-500 text-white shadow-sm font-medium"
        : "hover:bg-secondary text-muted-foreground hover:text-foreground"
    );
  };

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
            {isRoleSwitcherOpen && availableRoles.length > 1 && (
              <div className="mt-2 space-y-1">
                {availableRoles
                  .filter((r) => r.id !== activeRole.id)
                  .map((role) => (
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
              {visibleMainItems.map((item) => (
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
              {visibleDocumentItems.map((item) => (
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
                {visibleBottomItems.map((item) => (
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
