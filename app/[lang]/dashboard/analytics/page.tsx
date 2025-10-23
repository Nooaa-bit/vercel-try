"use client";

import { useState, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useActiveRole } from "@/app/hooks/useActiveRole";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart3 } from "lucide-react";
import { LoadingSpinner } from "@/components/ui/loading-spinner";



  export default function ProtectedPage() {
    // Get the active role from the context
    const { activeRole, hasPermission } = useActiveRole();
    const { t } = useTranslation("dashboard");
    const router = useRouter();
    
    // Check if user has permission to view this page
    const hasAccess = hasPermission('company_admin'); // company_admin or higher (superadmin)
    
    useEffect(() => {
      if (!hasAccess) {
        router.push('/dashboard');
      }
    }, [hasAccess, router]);
    
    // If not authorized, show nothing (will redirect)
    if (!hasAccess) {
      return null;
    }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">
          Analytics Dashboard
        </h1>
        <p className="text-muted-foreground mt-2">
          Advanced analytics and reporting
        </p>
      </div>

      <Card className="border-2 border-pulse-500">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-xl font-semibold">
            ✅ Access Granted
          </CardTitle>
          <BarChart3 className="h-6 w-6 text-pulse-500" />
        </CardHeader>
        <CardContent className="pt-6">
          <div className="space-y-4">
            <p className="text-lg">
              You are viewing this page as:{" "}
              <span className="font-bold capitalize text-pulse-500">
                {activeRole.role}
              </span>
            </p>
            <p className="text-muted-foreground">
              Company:{" "}
              <span className="font-medium text-foreground">
                {activeRole.companyName}
              </span>
            </p>

            <div className="mt-6 p-4 bg-muted rounded-lg border">
              <p className="font-semibold mb-2">🔒 Permission Test Results:</p>
              <ul className="space-y-1 text-sm text-muted-foreground list-disc list-inside">
                <li>✅ Superadmins: Can access</li>
                <li>✅ Company Admins: Can access</li>
                <li>❌ Supervisors: Redirected to dashboard</li>
                <li>❌ Talents: Redirected to dashboard</li>
              </ul>
            </div>

            <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-950 rounded-lg border border-blue-200 dark:border-blue-800">
              <p className="text-sm text-blue-900 dark:text-blue-100">
                <strong>Test scenarios:</strong>
              </p>
              <ul className="text-sm text-blue-900 dark:text-blue-100 mt-2 space-y-1 list-disc list-inside">
                <li>✅ Refresh page - should stay on analytics</li>
                <li>✅ Switch language - should stay on analytics</li>
                <li>✅ Use role switcher to lower role - should redirect</li>
                <li>✅ Direct URL access - permission based</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
