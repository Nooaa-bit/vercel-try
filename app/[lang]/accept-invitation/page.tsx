//hype-hire/vercel/app/[lang]/accept-invitation/page.tsx
"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter, useParams, usePathname } from "next/navigation";
import { useTranslation } from "react-i18next";
import { Loader2, CheckCircle, XCircle, Info } from "lucide-react";
import { useAuth } from "@/app/hooks/useAuth";

export default function AcceptJobInvitationPage() {
  const router = useRouter();
  const params = useParams();
  const pathname = usePathname();
  const { t, ready } = useTranslation("accept-job-invitation");
  const { user, loading: authLoading } = useAuth();

  const [status, setStatus] = useState<
    "loading" | "success" | "error" | "auth_required"
  >("loading");
  const [errorMessage, setErrorMessage] = useState("");
  const [successDetails, setSuccessDetails] = useState<{
    shiftsAssigned?: number;
    position?: string;
  }>({});

  // ✅ Prevent duplicate runs
  const hasRun = useRef(false);

  // Extract language from pathname
  const lang = pathname.split("/")[1] || "en";
  const token = params.token as string;

  useEffect(() => {
    // ✅ Guard against double execution (React 18 StrictMode, fast refresh)
    if (hasRun.current) return;
    hasRun.current = true;

    const accept = async () => {
      // 1. Wait for auth to load
      if (authLoading) return;

      // 2. Check if user is authenticated
      if (!user) {
        setStatus("auth_required");
        setErrorMessage(t("errors.loginRequired"));
        return;
      }

      // 3. Validate token
      if (!token) {
        setStatus("error");
        setErrorMessage(t("errors.noToken"));
        setTimeout(() => router.replace(`/${lang}/?error=no-token`), 2000);
        return;
      }

      // 4. Basic token format validation (cuid is ~25 chars)
      if (token.length < 20 || !/^[a-z0-9]+$/i.test(token)) {
        setStatus("error");
        setErrorMessage(t("errors.invalidToken"));
        setTimeout(() => router.replace(`/${lang}/?error=invalid-token`), 2000);
        return;
      }

      try {
        // 5. Call API to accept job invitation
        const response = await fetch("/api/invite/accept", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        });

        const data = await response.json();

        if (!response.ok) {
          // ✅ Handle specific error cases
          if (response.status === 404) {
            setStatus("error");
            setErrorMessage(t("errors.invitationNotFound"));
            setTimeout(
              () => router.replace(`/${lang}/dashboard?error=invite-not-found`),
              2000
            );
            return;
          }

          if (response.status === 410) {
            // Shifts are full
            setStatus("error");
            setErrorMessage(t("errors.spotsFilled"));
            setTimeout(
              () => router.replace(`/${lang}/dashboard?error=spots-filled`),
              2000
            );
            return;
          }

          if (response.status === 400 && data.error?.includes("already")) {
            // Already accepted - redirect to dashboard
            setStatus("success");
            setSuccessDetails({ shiftsAssigned: 0 });
            setTimeout(() => router.replace(`/${lang}/dashboard`), 1000);
            return;
          }

          // Generic error
          setStatus("error");
          setErrorMessage(data.error || t("errors.processingFailed"));
          setTimeout(
            () =>
              router.replace(`/${lang}/dashboard?error=${data.error || "failed"}`),
            2000
          );
          return;
        }

        // 6. Success
        setStatus("success");
        setSuccessDetails({
          shiftsAssigned: data.shiftsAssigned,
          position: data.position,
        });
        setTimeout(() => router.replace(`/${lang}/dashboard`), 2000);
      } catch (error) {
        console.error("Job invitation acceptance error:", error);
        setStatus("error");
        setErrorMessage(t("errors.unexpectedError"));
        setTimeout(
          () => router.replace(`/${lang}/dashboard?error=unexpected`),
          2000
        );
      }
    };

    accept();
  }, [authLoading, user]); // ✅ Run when auth state changes

  // Loading state while translations load
  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="max-w-md w-full text-center space-y-6">
        {/* Loading State */}
        {status === "loading" && (
          <>
            <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto">
              <Loader2 className="w-8 h-8 text-primary animate-spin" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground mb-2">
                {t("loading.title")}
              </h1>
              <p className="text-muted-foreground">
                {t("loading.description")}
              </p>
            </div>
            <div className="flex gap-1 justify-center">
              <div
                className="w-2 h-2 bg-primary rounded-full animate-bounce"
                style={{ animationDelay: "0ms" }}
              />
              <div
                className="w-2 h-2 bg-primary rounded-full animate-bounce"
                style={{ animationDelay: "150ms" }}
              />
              <div
                className="w-2 h-2 bg-primary rounded-full animate-bounce"
                style={{ animationDelay: "300ms" }}
              />
            </div>
          </>
        )}

        {/* Auth Required State */}
        {status === "auth_required" && (
          <>
            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto">
              <Info className="w-8 h-8 text-blue-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground mb-2">
                {t("authRequired.title")}
              </h1>
              <p className="text-muted-foreground mb-6">
                {t("authRequired.description")}
              </p>
              <button
                onClick={() =>
                  router.push(`/${lang}/login?redirect=/invite/accept/${token}`)
                }
                className="px-6 py-3 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-colors"
              >
                {t("authRequired.button")}
              </button>
            </div>
          </>
        )}

        {/* Success State */}
        {status === "success" && (
          <>
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground mb-2">
                {t("success.title")}
              </h1>
              <p className="text-muted-foreground mb-2">
                {successDetails.shiftsAssigned
                  ? t("success.descriptionWithShifts", {
                      count: successDetails.shiftsAssigned,
                    })
                  : t("success.description")}
              </p>
              {successDetails.position && (
                <p className="text-sm text-muted-foreground">
                  {t("success.position")}: <strong>{successDetails.position}</strong>
                </p>
              )}
              <p className="text-sm text-muted-foreground mt-4">
                {t("success.redirecting")}
              </p>
            </div>
          </>
        )}

        {/* Error State */}
        {status === "error" && (
          <>
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto">
              <XCircle className="w-8 h-8 text-red-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground mb-2">
                {t("error.title")}
              </h1>
              <p className="text-muted-foreground mb-4">
                {errorMessage || t("error.generic")}
              </p>
              <p className="text-sm text-muted-foreground">
                {t("error.redirecting")}
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
