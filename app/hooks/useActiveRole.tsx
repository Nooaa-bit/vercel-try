"use client";

import {
  createContext,
  useContext,
  useState,
  useMemo,
  useCallback,
  ReactNode,
} from "react";
import useSWR from "swr";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "./useAuth";
import { useTranslation } from "react-i18next";

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

interface RoleQueryResult {
  id: number;
  role: Role;
  company_id: number;
  company: { name: string }[] | null;
}

const ActiveRoleContext = createContext<ActiveRoleContext | undefined>(
  undefined
);

// Fetcher function for SWR
async function fetchUserRoles(userId: string): Promise<UserCompanyRole[]> {
  const supabase = createClient();

  try {
    // Fetch user profile
    const { data: profile, error: profileError } = await supabase
      .from("user")
      .select("id")
      .eq("auth_user_id", userId)
      .is("deleted_at", null)
      .maybeSingle();

    if (profileError || !profile) {
      console.error("Error fetching profile:", profileError);
      return [];
    }

    // Fetch roles
    const { data: roles, error: rolesError } = await supabase
      .from("user_company_role")
      .select("id, role, company_id, company(name)")
      .eq("user_id", profile.id)
      .is("revoked_at", null);

    if (rolesError || !roles) {
      console.error("Error fetching roles:", rolesError);
      return [];
    }

    return roles.map((r: RoleQueryResult) => ({
      id: r.id,
      role: r.role as Role,
      companyId: r.company_id,
      companyName: r.company?.[0]?.name || "Hype Hire",
    }));
  } catch (error) {
    console.error("Unexpected error loading roles:", error);
    return [];
  }
}

export function ActiveRoleProvider({ children }: { children: ReactNode }) {
  const { t, ready } = useTranslation("role-access");
  const { user, loading: authLoading } = useAuth();
  const [activeRoleId, setActiveRoleId] = useState<number | null>(null);

  // Use SWR with conditional fetching and 10-minute cache
  const {
    data: availableRoles = [],
    isLoading: rolesLoading,
    error,
  } = useSWR(
    user ? `roles-${user.id}` : null, // Conditional: only fetch if user exists
    () => fetchUserRoles(user!.id),
    {
      dedupingInterval: 600000, // 10 minutes in milliseconds
      revalidateOnFocus: false, // Don't refetch on window focus
      revalidateOnReconnect: true, // Refetch on reconnect
      shouldRetryOnError: true,
    }
  );

  // Set initial active role when roles are loaded
  useMemo(() => {
    if (availableRoles.length > 0 && activeRoleId === null) {
      const stored =
        typeof window !== "undefined"
          ? localStorage.getItem("activeRoleId")
          : null;
      const storedId = stored ? parseInt(stored) : null;
      const roleExists =
        storedId && availableRoles.some((r) => r.id === storedId);

      setActiveRoleId(roleExists ? storedId : availableRoles[0].id);
    }
  }, [availableRoles, activeRoleId]);

  const loading = authLoading || rolesLoading;
  const hasAttemptedLoad = !authLoading && !rolesLoading;

  const activeRole = useMemo(() => {
    if (availableRoles.length === 0) return null;
    return (
      availableRoles.find((r) => r.id === activeRoleId) || availableRoles[0]
    );
  }, [availableRoles, activeRoleId]);

  const setActiveRole = useCallback((roleId: number) => {
    setActiveRoleId(roleId);
    if (typeof window !== "undefined") {
      localStorage.setItem("activeRoleId", roleId.toString());
    }
  }, []);

  const hasPermission = useCallback(
    (requiredRole: Role) => {
      if (!activeRole) return false;
      return ROLE_WEIGHT[activeRole.role] >= ROLE_WEIGHT[requiredRole];
    },
    [activeRole]
  );

  const hasAnyRole = useCallback(
    (requiredRoles: Role[]) => {
      if (!activeRole) return false;
      return requiredRoles.some(
        (role) => ROLE_WEIGHT[activeRole.role] >= ROLE_WEIGHT[role]
      );
    },
    [activeRole]
  );

  const contextValue = useMemo(
    () => ({
      availableRoles,
      activeRole: activeRole!,
      activeCompanyId: activeRole?.companyId ?? 0,
      setActiveRole,
      hasPermission,
      hasAnyRole,
      loading,
    }),
    [
      availableRoles,
      activeRole,
      setActiveRole,
      hasPermission,
      hasAnyRole,
      loading,
    ]
  );

  if (loading || !ready) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-pulse-500 border-t-transparent rounded-full animate-spin" />
          {ready && (
            <div className="space-y-2 text-center">
              <div className="text-lg font-semibold">{t("loading.title")}</div>
              <div className="text-sm text-muted-foreground">
                {t("loading.subtitle")}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ✅ NEW: Skip error screen if user is logging out (user === null)
  if (hasAttemptedLoad && !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-pulse-500 border-t-transparent rounded-full animate-spin" />
          <div className="text-sm text-muted-foreground">
            {t("loading.subtitle")}
          </div>
        </div>
      </div>
    );
  }

  if (hasAttemptedLoad && (availableRoles.length === 0 || !activeRole)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="max-w-md text-center space-y-4">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto">
            <svg
              className="w-8 h-8 text-red-600"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </div>
          <div>
            <h2 className="text-xl font-semibold mb-2">
              {t("noAccess.title")}
            </h2>
            <p className="text-muted-foreground">{t("noAccess.description")}</p>
          </div>
          <div className="p-4 bg-muted rounded-lg text-sm text-left">
            <p className="font-medium mb-1">{t("noAccess.whatToDo")}</p>
            <ul className="list-disc list-inside space-y-1 text-muted-foreground">
              <li>{t("noAccess.step1")}</li>
              <li>{t("noAccess.step2")}</li>
              <li>{t("noAccess.step3")}</li>
            </ul>
          </div>
        </div>
      </div>
    );
  }

  return (
    <ActiveRoleContext.Provider value={contextValue}>
      {children}
    </ActiveRoleContext.Provider>
  );
}

export function useActiveRole() {
  const context = useContext(ActiveRoleContext);
  if (!context) {
    throw new Error("useActiveRole must be used within ActiveRoleProvider");
  }
  return context;
}
