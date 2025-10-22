//hype-hire/vercel/app/hooks/useActiveRole.tsx
"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "./useAuth";

type Role = "superadmin" | "company_admin" | "supervisor" | "worker";

const ROLE_WEIGHT: Record<Role, number> = {
  superadmin: 4,
  company_admin: 3,
  supervisor: 2,
  worker: 1,
};

interface UserCompanyRole {
  id: number;
  role: Role;
  companyId: number;
  companyName: string;
}

interface ActiveRoleContext {
  availableRoles: UserCompanyRole[];
  activeRole: UserCompanyRole;
  activeCompanyId: number;
  setActiveRole: (roleId: number) => void;
  hasPermission: (requiredRole: Role) => boolean;
  loading: boolean;
}

// Type for the Supabase query result
interface RoleQueryResult {
  id: number;
  role: Role;
  company_id: number;
  company: Array<{ name: string }> | null;
}

const DEFAULT_ROLE: UserCompanyRole = {
  id: 0,
  role: "worker",
  companyId: 0,
  companyName: "Hype Hire",
};

const ActiveRoleContext = createContext<ActiveRoleContext | undefined>(
  undefined
);

export function ActiveRoleProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [availableRoles, setAvailableRoles] = useState<UserCompanyRole[]>([]);
  const [activeRoleId, setActiveRoleId] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    async function loadRoles() {
      if (!user) {
        setAvailableRoles([]);
        setActiveRoleId(0);
        setLoading(false);
        return;
      }

      const { data: profile } = await supabase
        .from("user")
        .select("id")
        .eq("auth_user_id", user.id)
        .is("deleted_at", null)
        .maybeSingle();

      if (!profile) {
        setLoading(false);
        return;
      }

      const { data: roles } = await supabase
        .from("user_company_role")
        .select("id, role, company_id, company(name)")
        .eq("user_id", profile.id)
        .is("revoked_at", null);

      if (roles && roles.length > 0) {
        const formatted = roles.map((r: RoleQueryResult) => ({
          id: r.id,
          role: r.role as Role,
          companyId: r.company_id,
          companyName: r.company?.[0]?.name || "Hype Hire",
        }));

        setAvailableRoles(formatted);

        // Restore from localStorage or use first role
        const stored = localStorage.getItem("activeRoleId");
        const storedId = stored ? parseInt(stored) : null;
        const roleExists = storedId && formatted.some((r) => r.id === storedId);

        setActiveRoleId(roleExists ? storedId : formatted[0].id);
      }

      setLoading(false);
    }

    loadRoles();
  }, [user, supabase]);

  const activeRole =
    availableRoles.find((r) => r.id === activeRoleId) || DEFAULT_ROLE;

  const setActiveRole = (roleId: number) => {
    setActiveRoleId(roleId);
    localStorage.setItem("activeRoleId", roleId.toString());
  };

  const hasPermission = (requiredRole: Role) => {
    return ROLE_WEIGHT[activeRole.role] >= ROLE_WEIGHT[requiredRole];
  };

  return (
    <ActiveRoleContext.Provider
      value={{
        availableRoles,
        activeRole,
        activeCompanyId: activeRole.companyId,
        setActiveRole,
        hasPermission,
        loading,
      }}
    >
      {children}
    </ActiveRoleContext.Provider>
  );
}

export function useActiveRole() {
  const context = useContext(ActiveRoleContext);
  if (!context)
    throw new Error("useActiveRole must be used within ActiveRoleProvider");
  return context;
}
