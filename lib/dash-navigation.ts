// hype-hire/vercel/lib/dash-navigation.ts
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
  MapPinIcon,
} from "lucide-react";

type Role = "superadmin" | "company_admin" | "supervisor" | "talent";

export interface NavItem {
  titleKey: string;
  url: string;
  icon: React.ComponentType<{ className?: string }>;
  requiredRole?: Role;
  section: "main" | "documents" | "bottom";
}

export const NAV_ITEMS: NavItem[] = [
  // Main section
  {
    titleKey: "dashboard",
    url: "/dashboard",
    icon: LayoutDashboard,
    section: "main",
  },
  {
    titleKey: "calendar",
    url: "/dashboard/calendar",
    icon: CalendarIcon,
    section: "main",
  },
  {
    titleKey: "locations",
    url: "/dashboard/locations",
    icon: MapPinIcon,
    requiredRole: "company_admin",
    section: "main",
  },
  {
    titleKey: "team",
    url: "/dashboard/team",
    icon: Users,
    requiredRole: "company_admin",
    section: "main",
  },

  // Documents section
  {
    titleKey: "invitations",
    url: "/dashboard/invitations",
    icon: UserRoundPlus,
    section: "documents",
  },
  {
    titleKey: "analytics",
    url: "/dashboard/analytics",
    icon: BarChart3,
    requiredRole: "company_admin",
    section: "documents",
  },
  {
    titleKey: "contracts",
    url: "/dashboard/contracts",
    icon: FileText,
    section: "documents",
  },

  // Bottom section
  {
    titleKey: "settings",
    url: "/dashboard/settings",
    icon: Settings,
    section: "bottom",
  },
  {
    titleKey: "getHelp",
    url: "/dashboard/help",
    icon: HelpCircle,
    section: "bottom",
  },
  {
    titleKey: "search",
    url: "/dashboard/search",
    icon: Search,
    section: "bottom",
  },
];
