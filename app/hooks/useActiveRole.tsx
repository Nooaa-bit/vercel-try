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

//Data Transfer Object (DTO) 
interface UserCompanyRole {
  id: number;             // user_company_role.id (the role assignment record ID)
  userId: number;         // user.id (internal auto-increment user ID)
  role: Role;             // Which role: "talent", "supervisor", etc.
  companyId: number;      // company.id (which company this role is for)
  companyName: string;    // company.name (computed from join for UI display) 
//assignedDaysAgo: number;// Math.floor((now - createdAt) / day)
}//What one role assignment looks like: { id: 1, role: "company_admin", companyId: 5, companyName: "Acme" }

interface Company {
  id: number;
  name: string;
}//Simple company record for dropdown lists

interface ActiveRoleContext {
  availableRoles: UserCompanyRole[];                   // All roles this user has across all companies
  activeRole: UserCompanyRole;                         // Currently selected role (what user is acting as right now)
  activeCompanyId: number;                             // Shortcut to activeRole.companyId
  setActiveRole: (roleId: number) => Promise<boolean>; // Switch to a different role
  hasPermission: (requiredRole: Role) => boolean;      // Check if current role has permission
  hasAnyRole: (requiredRoles: Role[]) => boolean;      // Check if current role matches any of these
  loading: boolean;                                    // Still fetching roles/auth?
  availableCompanies: Company[];                       // All companies (for superadmin dropdown)
  selectedCompanyForAdmin: number | null;              // Which company superadmin is viewing
  setSelectedCompanyForAdmin: (companyId: number) => void; // Switch company (superadmin only)
  isSuperAdmin: boolean;                               // Quick check: is current role superadmin?
}


interface RoleRow {
  id: number;         // user_company_role.id
  role: Role;         // user_company_role.role
  company_id: number; // user_company_role.company_id
  user_id: number;    // user_company_role.user_id
}


interface CompanyRow {
  id: number;         // company.id
  name: string;       // company.name
}

const ActiveRoleContext = createContext<ActiveRoleContext | undefined>(
  undefined
); // Problem: Pass activeRole to 20 components via props? Nightmare. Solution: Context = invisible pipe through component tree.


// ============================================================================
// DATA FETCHING FUNCTIONS
// ============================================================================
/*Flow: 1. Convert auth UUID → internal user ID  2. Fetch all active (non-revoked) roles for that user 3. Fetch all companies to get names 4. Join role data with company names*/
async function fetchUserRoles(authUserId: string): Promise<UserCompanyRole[]> {
  const supabase = createClient();
  try {
    // STEP 1: Get user's internal ID from Supabase auth ID 
    const { data: userRecord, error: userError } = await supabase
      .from("user")
      .select("id")
      .eq("auth_user_id", authUserId)
      .is("deleted_at", null) // Only non-deleted users
      .maybeSingle();

    if (userError || !userRecord) {
      console.error("Error fetching user record:", userError);
      return [];
    }

    // STEP 2: Get all roles for this user
    const { data: roles, error: rolesError } = await supabase
      .from("user_company_role")
      .select("id, role, company_id, user_id")
      .eq("user_id", userRecord.id)
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
      id: r.id,                                                       // user_company_role.id
      userId: r.user_id,                                              // user.id (internal integer)
      role: r.role,                                                   // "talent" | "supervisor" | etc.
      companyId: r.company_id,                                        // company.id
      companyName: companyMap.get(r.company_id) || "Unknown Company", // Joined name
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
      .order("name"); // Alphabetical for dropdown

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


// ============================================================================
// PROVIDER COMPONENT
// ============================================================================
export function ActiveRoleProvider({ children }: { children: ReactNode }) {
  // Provider Setup
  const { t, ready } = useTranslation("role-access");
  const { user, loading: authLoading } = useAuth(); // user.id is Supabase Auth UUID (string)

  // Local state
  const [activeRoleId, setActiveRoleId] = useState<number | null>(null); // Which user_company_role.id is active
  const [selectedCompanyForAdmin, setSelectedCompanyForAdmin] = useState<
    number | null
  >(null); // For superadmin: which company are they viewing?

  /* SWR caches & fetches auser's roles. Cache key: unique per auth UUID
  Fetcher: converts auth UUID → internal ID → roles */
  const {
    data: availableRoles = [],
    isLoading: rolesLoading,
    mutate: mutateRoles,
  } = useSWR(
    user ? `roles-${user.id}` : null, // Cache key (user.id is auth UUID string)
    () => fetchUserRoles(user!.id), // user.id is authUserId (string)
    {
      dedupingInterval: 180000, // 3 minutes - don't refetch if fresh
      refreshInterval: 180000, // Auto-refresh every 3 minutes
      revalidateOnFocus: true, // Revalidate when tab regains focus
      revalidateOnReconnect: true, // Revalidate when internet reconnects
      revalidateIfStale: true, // Revalidate if data is stale
      shouldRetryOnError: true, // Retry on network errors
    },
  );

  /* Fetch and cache all companies (for superadmin)
   Cache key: global (same for all users)*/
  const { data: availableCompanies = [] } = useSWR(
    "all-companies",
    fetchAllCompanies,
    {
      dedupingInterval: 300000, // 5 minutes
      revalidateOnFocus: false, // Don't refetch on focus (slow changing data)
      revalidateOnReconnect: true, // Do refetch on reconnect
      shouldRetryOnError: true, // Retry on errors
    },
  );

  // Active Role from localStorage or default to first available role
  useEffect(() => {
    if (availableRoles.length > 0 && activeRoleId === null) {
      const storedRoleId =
        typeof window !== "undefined"
          ? localStorage.getItem("activeRoleId")
          : null;
      const parsedRoleId = storedRoleId ? parseInt(storedRoleId, 10) : null;

      // Validate: Does user still have this role?
      const roleExists =
        parsedRoleId !== null &&
        availableRoles.some((r) => r.id === parsedRoleId);

      if (roleExists) {
        setActiveRoleId(parsedRoleId);
      } else {
        // Stored role is invalid, use first available
        const fallbackRoleId = availableRoles[0].id;
        setActiveRoleId(fallbackRoleId);

        if (typeof window !== "undefined") {
          localStorage.setItem("activeRoleId", fallbackRoleId.toString());
        }
      }
    }
  }, [availableRoles, activeRoleId]);

  // When roles update, revalidate active role
  useEffect(() => {
    if (activeRoleId !== null && availableRoles.length > 0) {
      const roleStillExists = availableRoles.some((r) => r.id === activeRoleId);

      if (!roleStillExists) {
        console.warn(
          `[useActiveRole] Active role ${activeRoleId} no longer exists, resetting`,
        );
        const fallbackId = availableRoles[0].id;
        setActiveRoleId(fallbackId);
        if (typeof window !== "undefined") {
          localStorage.setItem("activeRoleId", fallbackId.toString());
        }
      }
    }
  }, [availableRoles, activeRoleId]);

  // ============================================================================
  // COMPUTED STATE
  // ============================================================================
  const loading = authLoading || rolesLoading;
  const hasAttemptedLoad = !authLoading && !rolesLoading;

  /* Active role object (memoized) This is the role the user is currently "acting as"*/
  const activeRole = useMemo(() => {
    if (availableRoles.length === 0) return null;
    return (
      availableRoles.find((r) => r.id === activeRoleId) || availableRoles[0]
    );
  }, [availableRoles, activeRoleId]);

  const isSuperAdmin = activeRole?.role === "superadmin";

  // Role Switching Functions. When user clicks role in dropdown, 1. Update React state 2. Clear superadmin company selection (fresh start) 3. Save to localStorage (survive refresh)
  const setActiveRole = useCallback(
    async (newRoleId: number): Promise<boolean> => {
      // Security: Revalidate roles from server before switching
      const freshRoles = await mutateRoles();

      if (!freshRoles) {
        console.error("[setActiveRole] Failed to fetch fresh roles");
        return false;
      }

      // Validate the requested role exists and belongs to user
      const roleExists = freshRoles.some((r) => r.id === newRoleId);

      if (!roleExists) {
        console.error(
          `[setActiveRole] Role ${newRoleId} does not exist or was revoked`,
        );
        return false;
      }

      // Role is valid, proceed with switch
      setActiveRoleId(newRoleId);
      setSelectedCompanyForAdmin(null);

      if (typeof window !== "undefined") {
        localStorage.setItem("activeRoleId", newRoleId.toString());
      }

      return true;
    },
    [mutateRoles],
  );

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
      const storedCompanyId =
        typeof window !== "undefined"
          ? localStorage.getItem("selectedCompanyForAdmin")
          : null;
      const parsedCompanyId = storedCompanyId
        ? parseInt(storedCompanyId, 10)
        : null;

      if (
        parsedCompanyId &&
        availableCompanies.some((c) => c.id === parsedCompanyId)
      ) {
        setSelectedCompanyForAdmin(parsedCompanyId);
      } else if (availableCompanies.length > 0) {
        setSelectedCompanyForAdmin(availableCompanies[0].id);
      }
    }
  }, [isSuperAdmin, availableCompanies, selectedCompanyForAdmin]);

  // ============================================================================
  // PERMISSION HELPERS
  // ============================================================================
  /* Check if current role has at least the required permission level
   Example:
   * - hasPermission("supervisor") returns true for: supervisor, company_admin, superadmin
   * - hasPermission("supervisor") returns false for: talent
   * @param requiredRole - Minimum role required
   * @returns true if current role weight >= required role weight
   */
  const hasPermission = useCallback(
    (requiredRole: Role) => {
      if (!activeRole) return false;
      return ROLE_WEIGHT[activeRole.role] >= ROLE_WEIGHT[requiredRole];
    },
    [activeRole],
  );

  /* Check if current role matches ANY of the required roles (OR condition)
   *
   * Example:
   * - hasAnyRole(["supervisor", "company_admin"]) returns true for either role
   *
   * @param requiredRoles - Array of acceptable roles
   * @returns true if current role has permission for any of them
   */
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

  // Success: User has roles, render children with context
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

/*Hook to access active role context
 * Must be used within <ActiveRoleProvider>
 * 
 * Usage:
 * ```tsx
 * const { activeRole, hasPermission, setActiveRole } = useActiveRole();
 * 
 * if (hasPermission("supervisor")) {
 *   // Show supervisor-only UI
 * }
 * ```
 * 
 * @throws Error if used outside ActiveRoleProvider
 */