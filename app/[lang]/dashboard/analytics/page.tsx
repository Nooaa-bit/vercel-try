"use client";

import { useState, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useActiveRole } from "@/app/hooks/useActiveRole";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart3 } from "lucide-react";

export default function AnalyticsPage() {
  const { t } = useTranslation("dashboard");
  const router = useRouter();
  const pathname = usePathname();
  const { activeRole, hasPermission, loading } = useActiveRole();
  const [mounted, setMounted] = useState(false);

  // Wait for component to mount on client side
  useEffect(() => {
    setMounted(true);
  }, []);

  // Only check permissions after both mounted AND loading complete
  useEffect(() => {
    if (mounted && !loading) {
      if (!hasPermission("company_admin")) {
        const langMatch = pathname?.match(/^\/([^/]+)\//);
        const lang = langMatch ? langMatch[1] : "en";
        router.replace(`/${lang}/dashboard`);
      }
    }
  }, [mounted, loading, hasPermission, router, pathname]);

  // Show nothing until component mounts (prevents hydration issues)
  if (!mounted || loading) {
    return (
      <div className="min-h-screen bg-background pt-20 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-pulse-500 border-t-transparent rounded-full animate-spin"></div>
          <span className="text-sm text-muted-foreground">Loading...</span>
        </div>
      </div>
    );
  }

  // Final permission check before rendering
  if (!hasPermission("company_admin")) {
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
