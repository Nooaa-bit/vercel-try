//hype-hire/vercel/app/hooks/useActiveRole.tsx
"use client";

import {
  createContext,
  useContext,
  useState,
  useMemo,
  useCallback,
  ReactNode,
  useEffect,
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
  id: number; // Database row ID (user_company_role.id)
  userId: number; // Which user (user.id)
  role: Role; // "talent", "supervisor", etc.
  companyId: number; // Which company
  companyName: string; // "ABC Staffing" (human readable)
}                       //What one role assignment looks like: "John is a supervisor at ABC Staffing"

interface Company {
  id: number;
  name: string;
}//Simple company record for dropdown lists.

interface ActiveRoleContext {
  availableRoles: UserCompanyRole[];   // All roles user has
  activeRole: UserCompanyRole;         // Currently selected role
  activeCompanyId: number;             // Shortcut to activeRole.companyId
  setActiveRole: (roleId: number) => void;  // Switch role
  hasPermission: (requiredRole: Role) => boolean;  // Can user do X?
  hasAnyRole: (requiredRoles: Role[]) => boolean;  // Can user do X or Y?
  loading: boolean;                    // Still fetching?
  availableCompanies: Company[];       // All companies (superadmin)
  selectedCompanyForAdmin: number | null;  // Superadmin viewing which company
  setSelectedCompanyForAdmin: (companyId: number) => void;  // Switch company
  isSuperAdmin: boolean;               // Quick check
}


interface RoleRow {
  id: number;
  role: Role;
  company_id: number;
  user_id: number; // Added user_id
}

interface CompanyRow {
  id: number;
  name: string;
}

const ActiveRoleContext = createContext<ActiveRoleContext | undefined>(
  undefined
); // Problem: Pass activeRole to 20 components via props? Nightmare. Solution: Context = invisible pipe through component tree.

async function fetchUserRoles(userId: string): Promise<UserCompanyRole[]> {
  const supabase = createClient(); 
  try {
    // STEP 1: Get user's internal ID from Supabase auth ID
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

    // STEP 2: Get all roles for this user
    const { data: roles, error: rolesError } = await supabase
      .from("user_company_role")
      .select("id, role, company_id, user_id")
      .eq("user_id", profile.id)
      .is("revoked_at", null);

    if (rolesError || !roles) {
      console.error("Error fetching roles:", rolesError);
      return [];
    }

    // STEP 3: Get all company names
    const { data: companies, error: companiesError } = await supabase
      .from("company")
      .select("id, name")
      .is("deleted_at", null);

    if (companiesError) {
      console.error("Error fetching companies:", companiesError);
      return [];
    }

    // STEP 4: Build lookup map (company_id → name)
    const companyMap = new Map<number, string>(
      (companies as CompanyRow[]).map((c) => [c.id, c.name]),
    );

    // STEP 5: Transform database rows → app format
    return (roles as RoleRow[]).map((r) => ({
      id: r.id, // user_company_role.id
      userId: r.user_id, // user.id (the actual user ID)
      role: r.role,
      companyId: r.company_id,
      companyName: companyMap.get(r.company_id) || "Unknown Company",
    }));
  } catch (error) {
    console.error("Unexpected error loading roles:", error);
    return [];
  }
} //  database connection to fetch user_company_role along with company names. Why 3 queries? Supabase doesn't have clean joins → Manual mapping

async function fetchAllCompanies(): Promise<Company[]> {
  const supabase = createClient();

  try {
    const { data: companies, error } = await supabase
      .from("company")
      .select("id, name")
      .is("deleted_at", null)
      .order("name");

    if (error) {
      console.error("Error fetching companies:", error);
      return [];
    }

    return companies as Company[];
  } catch (error) {
    console.error("Unexpected error loading companies:", error);
    return [];
  }
}//Why separate function? Superadmins need ALL companies for dropdown. Regular users only see their assigned companies.

export function ActiveRoleProvider({ children }: { children: ReactNode }) {
  // Provider Setup
  const { t, ready } = useTranslation("role-access");
  const { user, loading: authLoading } = useAuth(); // Get logged-in user
  const [activeRoleId, setActiveRoleId] = useState<number | null>(null);
  const [selectedCompanyForAdmin, setSelectedCompanyForAdmin] = useState<
    number | null
  >(null);

  //SWR caches roles to avoid refetching on every hook call
  const { data: availableRoles = [], isLoading: rolesLoading } = useSWR(
    user ? `roles-${user.id}` : null, // Cache key (unique per user)
    () => fetchUserRoles(user!.id), // Fetcher function
    {
      dedupingInterval: 600000, // 10 minutes cache
      revalidateOnFocus: false, // Don't refetch on tab switch
      revalidateOnReconnect: true, // Do refetch on internet back
      shouldRetryOnError: true, // Retry on network fail
    },
  );

  const { data: availableCompanies = [] } = useSWR(
    "all-companies",
    fetchAllCompanies,
    {
      dedupingInterval: 600000,
      revalidateOnFocus: false,
      revalidateOnReconnect: true,
      shouldRetryOnError: true,
    },
  );

  // Active Role from localStorage or default to first available role
  useEffect(() => {
    if (availableRoles.length > 0 && activeRoleId === null) {
      // Check localStorage for previously selected role
      const stored =
        typeof window !== "undefined"
          ? localStorage.getItem("activeRoleId")
          : null;
      const storedId = stored ? parseInt(stored, 10) : null;
      // Validate: Does user still have this role?
      const roleExists =
        storedId !== null && availableRoles.some((r) => r.id === storedId);
      // Use stored role if valid, otherwise first available
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

  const isSuperAdmin = activeRole?.role === "superadmin";

  // Role Switching Functions. When user clicks role in dropdown, 1. Update React state 2. Clear superadmin company selection (fresh start) 3. Save to localStorage (survive refresh)
  const setActiveRole = useCallback((roleId: number) => {
    setActiveRoleId(roleId); // Update state
    setSelectedCompanyForAdmin(null); // Reset superadmin view
    if (typeof window !== "undefined") {
      localStorage.setItem("activeRoleId", roleId.toString()); // Persist
    }
  }, []);
  // When superadmin selects a company to view, save it to state and localStorage
  const handleSetSelectedCompanyForAdmin = useCallback((companyId: number) => {
    setSelectedCompanyForAdmin(companyId);
    if (typeof window !== "undefined") {
      localStorage.setItem("selectedCompanyForAdmin", companyId.toString());
    }
  }, []);

  // On load, if superadmin with no selected company, set from localStorage or default to first company
  useEffect(() => {
    if (isSuperAdmin && selectedCompanyForAdmin === null) {
      const stored =
        typeof window !== "undefined"
          ? localStorage.getItem("selectedCompanyForAdmin")
          : null;
      const storedId = stored ? parseInt(stored, 10) : null;

      if (storedId && availableCompanies.some((c) => c.id === storedId)) {
        setSelectedCompanyForAdmin(storedId);
      } else if (availableCompanies.length > 0) {
        setSelectedCompanyForAdmin(availableCompanies[0].id);
      }
    }
  }, [isSuperAdmin, availableCompanies, selectedCompanyForAdmin]);

  //Permission Functions
  const hasPermission = useCallback(
    (requiredRole: Role) => {
      if (!activeRole) return false;
      return ROLE_WEIGHT[activeRole.role] >= ROLE_WEIGHT[requiredRole];
    },
    [activeRole],
  );

  const hasAnyRole = useCallback(
    (requiredRoles: Role[]) => {
      if (!activeRole) return false;
      return requiredRoles.some(
        (role) => ROLE_WEIGHT[activeRole.role] >= ROLE_WEIGHT[role],
      );
    },
    [activeRole],
  );

  //Bundle everything into one object. useMemo prevents re-creating on every render → Prevents child re-renders.
  const contextValue = useMemo(
    () => ({
      availableRoles,
      activeRole: activeRole!,
      activeCompanyId: activeRole?.companyId ?? 0,
      setActiveRole,
      hasPermission,
      hasAnyRole,
      loading,
      availableCompanies,
      selectedCompanyForAdmin,
      setSelectedCompanyForAdmin: handleSetSelectedCompanyForAdmin,
      isSuperAdmin,
    }),
    [
      availableRoles,
      activeRole,
      setActiveRole,
      hasPermission,
      hasAnyRole,
      loading,
      availableCompanies,
      selectedCompanyForAdmin,
      handleSetSelectedCompanyForAdmin,
      isSuperAdmin,
    ],
  );

  //Loading State UI
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

  //Edge case: Auth finished but no user → Still show spinner (useAuth will redirect to login).
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

  // No roles assigned → Show help message
  if (hasAttemptedLoad && (availableRoles.length === 0 || !activeRole)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="max-w-md text-center space-y-4">
          {/* Warning icon */}
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
          {/* Message */}
          <div>
            <h2 className="text-xl font-semibold mb-2">
              {t("noAccess.title")}
            </h2>
            <p className="text-muted-foreground">{t("noAccess.description")}</p>
          </div>
          {/* Help box */}
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
