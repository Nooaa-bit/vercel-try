// hype-hire/vercel/lib/server-auth.ts Created with Opus

import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import type { Session, SupabaseClient } from "@supabase/supabase-js";

// =============================================================================
// TYPES
// =============================================================================

type Role = "talent" | "supervisor" | "company_admin" | "superadmin";

const ROLE_WEIGHT: Record<Role, number> = {
  talent: 1,
  supervisor: 2,
  company_admin: 3,
  superadmin: 4,
};

interface UserRole {
  id: number; // user_company_role.id
  userId: number; // user.id
  role: Role;
  companyId: number;
  companyName: string;
}

// Result pattern - explicit success/failure, no try/catch needed by caller
type AuthResult<T> =
  | { success: true; data: T }
  | { success: false; error: string };

// =============================================================================
// SUPABASE CLIENT - Fresh per request, no caching
// =============================================================================

async function createSupabaseServer(): Promise<SupabaseClient> {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Server Components can't set cookies
          }
        },
      },
    },
  );
}

// =============================================================================
// AUTHENTICATION - Who is this user?
// =============================================================================

export async function getServerSession(): Promise<Session | null> {
  const supabase = await createSupabaseServer();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return session;
}

export async function requireAuth(): Promise<AuthResult<Session>> {
  const session = await getServerSession();
  if (!session) {
    return { success: false, error: "Unauthorized" };
  }
  return { success: true, data: session };
}

// =============================================================================
// USER IDENTITY - Get internal user ID from auth
// =============================================================================

export async function getInternalUserId(
  authUserId: string,
): Promise<AuthResult<number>> {
  const supabase = await createSupabaseServer();

  const { data: profile, error } = await supabase
    .from("user")
    .select("id")
    .eq("auth_user_id", authUserId)
    .is("deleted_at", null)
    .maybeSingle();

  if (error || !profile) {
    console.error("[getInternalUserId] Failed:", error);
    return { success: false, error: "Unauthorized" };
  }

  return { success: true, data: profile.id };
}

// Convenience: Get userId from current session
export async function getCurrentUserId(): Promise<AuthResult<number>> {
  const authResult = await requireAuth();
  if (!authResult.success) {
    return authResult;
  }
  return getInternalUserId(authResult.data.user.id);
}

// =============================================================================
// ROLE FETCHING - What roles does this user have?
// =============================================================================

export async function getAllUserRoles(
  userId: number,
): Promise<AuthResult<UserRole[]>> {
  const supabase = await createSupabaseServer();

  // Get roles
  const { data: roles, error: rolesError } = await supabase
    .from("user_company_role")
    .select("id, role, company_id, user_id")
    .eq("user_id", userId)
    .is("revoked_at", null);

  if (rolesError) {
    console.error("[getAllUserRoles] Failed:", rolesError);
    return { success: false, error: "Unauthorized" };
  }

  if (!roles || roles.length === 0) {
    return { success: true, data: [] };
  }

  // Get company names
  const companyIds = [...new Set(roles.map((r) => r.company_id))];
  const { data: companies, error: companiesError } = await supabase
    .from("company")
    .select("id, name")
    .in("id", companyIds)
    .is("deleted_at", null);

  if (companiesError) {
    console.error("[getAllUserRoles] Companies fetch failed:", companiesError);
    return { success: false, error: "Unauthorized" };
  }

  const companyMap = new Map(
    (companies || []).map((c) => [c.id, c.name as string]),
  );

  const userRoles: UserRole[] = roles.map((r) => ({
    id: r.id,
    userId: r.user_id,
    role: r.role as Role,
    companyId: r.company_id,
    companyName: companyMap.get(r.company_id) || "Unknown",
  }));

  return { success: true, data: userRoles };
}

// =============================================================================
// ROLE VALIDATION - Does user own this specific role?
// =============================================================================

export async function validateRoleOwnership(
  userId: number,
  roleId: number,
): Promise<AuthResult<UserRole>> {
  const supabase = await createSupabaseServer();

  const { data: role, error } = await supabase
    .from("user_company_role")
    .select("id, role, company_id, user_id")
    .eq("id", roleId)
    .eq("user_id", userId)
    .is("revoked_at", null)
    .maybeSingle();

  if (error || !role) {
    return { success: false, error: "Unauthorized" };
  }

  // Get company name
  const { data: company } = await supabase
    .from("company")
    .select("name")
    .eq("id", role.company_id)
    .is("deleted_at", null)
    .maybeSingle();

  return {
    success: true,
    data: {
      id: role.id,
      userId: role.user_id,
      role: role.role as Role,
      companyId: role.company_id,
      companyName: company?.name || "Unknown",
    },
  };
}

// =============================================================================
// COMPANY ACCESS - Does user have access to this company?
// =============================================================================

export async function getUserRoleForCompany(
  userId: number,
  companyId: number,
): Promise<AuthResult<UserRole>> {
  const supabase = await createSupabaseServer();

  const { data: role, error } = await supabase
    .from("user_company_role")
    .select("id, role, company_id, user_id")
    .eq("user_id", userId)
    .eq("company_id", companyId)
    .is("revoked_at", null)
    .maybeSingle();

  if (error || !role) {
    return { success: false, error: "Unauthorized" };
  }

  const { data: company } = await supabase
    .from("company")
    .select("name")
    .eq("id", companyId)
    .is("deleted_at", null)
    .maybeSingle();

  return {
    success: true,
    data: {
      id: role.id,
      userId: role.user_id,
      role: role.role as Role,
      companyId: role.company_id,
      companyName: company?.name || "Unknown",
    },
  };
}

// =============================================================================
// PERMISSION CHECKS - Does user have sufficient permissions?
// =============================================================================

export function hasMinimumRole(userRole: Role, requiredRole: Role): boolean {
  return ROLE_WEIGHT[userRole] >= ROLE_WEIGHT[requiredRole];
}

export function isSuperAdmin(role: UserRole): boolean {
  return role.role === "superadmin";
}

// =============================================================================
// COMBINED AUTHORIZATION - The main functions you'll use
// =============================================================================

/**
 * Verify current user owns the roleId AND has minimum permission level
 * Use when client sends roleId (from their activeRole)
 */
export async function authorizeByRoleId(
  roleId: number,
  minRole: Role = "talent",
): Promise<AuthResult<UserRole>> {
  // Step 1: Get authenticated user
  const userResult = await getCurrentUserId();
  if (!userResult.success) {
    return userResult;
  }

  // Step 2: Verify user owns this role
  const roleResult = await validateRoleOwnership(userResult.data, roleId);
  if (!roleResult.success) {
    return roleResult;
  }

  // Step 3: Check permission level
  if (!hasMinimumRole(roleResult.data.role, minRole)) {
    return { success: false, error: "Unauthorized" };
  }

  return roleResult;
}

/**
 * Verify current user has access to company AND has minimum permission level
 * Use when you know the companyId but not the roleId
 */
export async function authorizeByCompanyId(
  companyId: number,
  minRole: Role = "talent",
): Promise<AuthResult<UserRole>> {
  // Step 1: Get authenticated user
  const userResult = await getCurrentUserId();
  if (!userResult.success) {
    return userResult;
  }

  // Step 2: Get user's role at this company
  const roleResult = await getUserRoleForCompany(userResult.data, companyId);
  if (!roleResult.success) {
    return roleResult;
  }

  // Step 3: Check permission level
  if (!hasMinimumRole(roleResult.data.role, minRole)) {
    return { success: false, error: "Unauthorized" };
  }

  return roleResult;
}

/**
 * Verify current user is a superadmin
 */
export async function requireSuperAdmin(): Promise<AuthResult<UserRole>> {
  // Step 1: Get authenticated user
  const userResult = await getCurrentUserId();
  if (!userResult.success) {
    return userResult;
  }

  // Step 2: Get all roles
  const rolesResult = await getAllUserRoles(userResult.data);
  if (!rolesResult.success) {
    return rolesResult;
  }

  // Step 3: Find superadmin role
  const superAdminRole = rolesResult.data.find((r) => r.role === "superadmin");
  if (!superAdminRole) {
    return { success: false, error: "Unauthorized" };
  }

  return { success: true, data: superAdminRole };
}

/**
 * Just get the current user's info without role checks
 * Useful for pages where you need to know who's logged in but no specific role required
 */
export async function getAuthenticatedUser(): Promise<
  AuthResult<{ session: Session; userId: number; roles: UserRole[] }>
> {
  const authResult = await requireAuth();
  if (!authResult.success) {
    return authResult;
  }

  const userIdResult = await getInternalUserId(authResult.data.user.id);
  if (!userIdResult.success) {
    return userIdResult;
  }

  const rolesResult = await getAllUserRoles(userIdResult.data);
  if (!rolesResult.success) {
    return rolesResult;
  }

  return {
    success: true,
    data: {
      session: authResult.data,
      userId: userIdResult.data,
      roles: rolesResult.data,
    },
  };
}
