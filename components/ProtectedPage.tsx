"use client";

import { ReactNode } from "react";
import { useActiveRole } from "@/app/hooks/useActiveRole";
import { useRouter, usePathname } from "next/navigation";
import { useEffect } from "react";

type Role = "superadmin" | "company_admin" | "supervisor" | "talent";

interface ProtectedPageProps {
  children: ReactNode;
  requiredRole?: Role;
  requiredAnyRole?: Role[];
  redirectTo?: string; // Custom redirect path
}

// Translations object
const translations = {
  en: {
    access: {
      denied: "Access denied. Redirecting...",
    },
  },
  el: {
    access: {
      denied: "Δεν έχετε πρόσβαση. Ανακατεύθυνση...",
    },
  },
};

export function ProtectedPage({
  children,
  requiredRole,
  requiredAnyRole,
  redirectTo,
}: ProtectedPageProps) {
  const { hasPermission, hasAnyRole, loading } = useActiveRole();
  const router = useRouter();
  const pathname = usePathname();
  const lang = (pathname.split("/")[1] || "en") as keyof typeof translations;

  // Get translations for current language
  const t = translations[lang] || translations.en;

  // Determine where to redirect (defaults to dashboard)
  const defaultRedirect = `/${lang}/dashboard`;
  const redirectPath = redirectTo || defaultRedirect;

  useEffect(() => {
    if (loading) return;

    let hasAccess = true;

    if (requiredRole) {
      hasAccess = hasPermission(requiredRole);
    } else if (requiredAnyRole) {
      hasAccess = hasAnyRole(requiredAnyRole);
    }

    if (!hasAccess) {
      router.replace(redirectPath);
    }
  }, [
    loading,
    hasPermission,
    hasAnyRole,
    requiredRole,
    requiredAnyRole,
    router,
    redirectPath,
  ]);

  // Show loading while checking permissions
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-pulse-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // Check permission and block render if denied
  let hasAccess = true;
  if (requiredRole) {
    hasAccess = hasPermission(requiredRole);
  } else if (requiredAnyRole) {
    hasAccess = hasAnyRole(requiredAnyRole);
  }

  // Don't render children if no access
  if (!hasAccess) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">{t.access.denied}</p>
      </div>
    );
  }

  return <>{children}</>;
}
