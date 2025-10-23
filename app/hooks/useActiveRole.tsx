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

type Role = "superadmin" | "company_admin" | "supervisor" | "talent";

const ROLE_WEIGHT: Record<Role, number> = {
  superadmin: 4,
  company_admin: 3,
  supervisor: 2,
  talent: 1,
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
  hasAnyRole: (requiredRoles: Role[]) => boolean;
  loading: boolean;
}

// Type for the Supabase query result
interface RoleQueryResult {
  id: number;
  role: Role;
  company_id: number;
  company: Array<{ name: string }> | null;
}

// No default role - we'll handle loading state explicitly

const ActiveRoleContext = createContext<ActiveRoleContext | undefined>(
  undefined
);

export function ActiveRoleProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [availableRoles, setAvailableRoles] = useState<UserCompanyRole[]>([]);
  const [activeRoleId, setActiveRoleId] = useState<number | null>(null); // Changed: null instead of 0
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    async function loadRoles() {
      if (!user) {
        setAvailableRoles([]);
        setActiveRoleId(null); // Changed: null instead of 0
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

  // Don't render anything until we've finished loading the roles
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-pulse-500 border-t-transparent rounded-full animate-spin"></div>
          <span className="text-sm text-muted-foreground">
            Loading your account...
          </span>
        </div>
      </div>
    );
  }

  // If we have no roles after loading, something went wrong
  if (availableRoles.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="text-center">
          <h2 className="text-lg font-semibold mb-2">No roles found</h2>
          <p className="text-muted-foreground">
            You do not have access to any companies. Please contact support.
          </p>
        </div>
      </div>
    );
  }

  // At this point, we know we have at least one role
  const activeRole = availableRoles.find((r) => r.id === activeRoleId) || availableRoles[0];

  const setActiveRole = (roleId: number) => {
    setActiveRoleId(roleId);
    localStorage.setItem("activeRoleId", roleId.toString());
  };

  const hasPermission = (requiredRole: Role) => {
    return ROLE_WEIGHT[activeRole.role] >= ROLE_WEIGHT[requiredRole];
  };

  const providerHasAnyRole = (requiredRoles: Role[]) => {
    if (loading) return false;
    return requiredRoles.some((role) => hasPermission(role));
  };

  return (
    <ActiveRoleContext.Provider
      value={{
        availableRoles,
        activeRole,
        activeCompanyId: activeRole.companyId,
        setActiveRole,
        hasPermission,
        hasAnyRole: providerHasAnyRole,
        loading,
      }}
    >
      {children}
    </ActiveRoleContext.Provider>
  );
}

export function useActiveRole() {
  const context = useContext(ActiveRoleContext);
  if (!context) {
    throw new Error("useActiveRole must be used within ActiveRoleProvider");
  }

  // Helper to check if user has any of the required roles
  const hasAnyRole = (requiredRoles: Role[]) => {
    if (context.loading) return false; // Don't allow access while loading
    return requiredRoles.some((role) => context.hasPermission(role));
  };

  return {
    ...context,
    hasAnyRole,
  };
}