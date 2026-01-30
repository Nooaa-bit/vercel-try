// components/ProtectedSection.tsx 
"use client";

import { ReactNode } from "react";
import { useActiveRole } from "@/app/hooks/useActiveRole";

type Role = "superadmin" | "company_admin" | "supervisor" | "talent";

interface Props {
  children: ReactNode;
  requiredRole?: Role;              // Minimum role required
  requiredAnyRole?: Role[];         // Match any of these roles
  fallback?: ReactNode;             // Show this if no access (default: nothing)
  showLoading?: boolean;            // Show fallback during loading? (default: true)
}

/* Conditionally render children based on user's role
 * 
 * Usage:
 * <ProtectedSection requiredRole="supervisor">
 *   <CreateJobButton />
 * </ProtectedSection>
 * 
 * <ProtectedSection requiredAnyRole={["supervisor", "company_admin"]} fallback={<UpgradePrompt />}>
 *   <PremiumFeature />
 * </ProtectedSection>
 * 
 * NOTE: This is for UI hiding only. ALWAYS enforce permissions on the server.
 */
export function ProtectedSection({
  children,
  requiredRole,
  requiredAnyRole,
  fallback = null,
  showLoading = true,
}: Props) {
  const { hasPermission, hasAnyRole, loading } = useActiveRole();

  // Show fallback during loading if requested
  if (loading && showLoading) return <>{fallback}</>;

  // Determine access
  let hasAccess = true;
  
  if (requiredRole) {
    hasAccess = hasPermission(requiredRole);
  } else if (requiredAnyRole) {
    hasAccess = hasAnyRole(requiredAnyRole);
  }

  return hasAccess ? <>{children}</> : <>{fallback}</>;
}
