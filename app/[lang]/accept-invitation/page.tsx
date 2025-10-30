//hype-hire/vercel/app/[lang]/accept-invitation/page.tsx
"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useTranslation } from "react-i18next";
import { Loader2, CheckCircle, XCircle } from "lucide-react";

export default function AcceptInvitationPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const { t, ready } = useTranslation("accept-invitation");

  const [status, setStatus] = useState<"loading" | "success" | "error">(
    "loading"
  );
  const [errorMessage, setErrorMessage] = useState("");

  // ✅ Prevent duplicate runs
  const hasRun = useRef(false);

  // Extract language from pathname
  const lang = pathname.split("/")[1] || "en";

  useEffect(() => {
    // ✅ Guard against double execution (React 18 StrictMode, fast refresh)
    if (hasRun.current) return;
    hasRun.current = true;

    const accept = async () => {
      // 1. Get and validate token
      const token = searchParams.get("token");

      if (!token) {
        setStatus("error");
        setErrorMessage(t("errors.noToken"));
        setTimeout(() => router.replace(`/${lang}/?error=no-token`), 2000);
        return;
      }

      // 2. Basic token format validation (UUID is 36 chars)
      if (token.length !== 36 || !/^[a-f0-9-]+$/i.test(token)) {
        setStatus("error");
        setErrorMessage(t("errors.invalidToken"));
        setTimeout(() => router.replace(`/${lang}/?error=invalid-token`), 2000);
        return;
      }

      try {
        // 3. Call API to process invitation
        const response = await fetch(`/api/invitations/accept?token=${token}`);

        if (!response.ok) {
          const error = await response.json();

          // ✅ Special handling for "already accepted" (user might have refreshed)
          if (error.error === "already-used") {
            // Check if they're already logged in
            const supabase = createClient();
            const {
              data: { user },
            } = await supabase.auth.getUser();

            if (user) {
              // They're logged in, just redirect to dashboard
              setStatus("success");
              setTimeout(() => router.replace(`/${lang}/dashboard`), 1000);
              return;
            }
          }

          setStatus("error");
          setErrorMessage(error.error || t("errors.processingFailed"));
          setTimeout(
            () => router.replace(`/${lang}/?error=${error.error || "failed"}`),
            2000
          );
          return;
        }

        const { hashedToken } = await response.json();

        // 4. Verify OTP to create session
        const supabase = createClient();
        const { error } = await supabase.auth.verifyOtp({
          token_hash: hashedToken,
          type: "magiclink",
        });

        if (error) {
          console.error("OTP verification error:", error);
          setStatus("error");
          setErrorMessage(t("errors.sessionCreationFailed"));
          setTimeout(() => router.replace(`/${lang}/?error=auth-failed`), 2000);
          return;
        }

        // 5. Success - redirect to dashboard
        setStatus("success");
        setTimeout(() => router.replace(`/${lang}/dashboard`), 1000);
      } catch (error) {
        console.error("Invitation acceptance error:", error);
        setStatus("error");
        setErrorMessage(t("errors.unexpectedError"));
        setTimeout(() => router.replace(`/${lang}/?error=unexpected`), 2000);
      }
    };

    accept();
  }, []); // ✅ Empty deps + ref guard prevents double execution

  // Loading state while translations load
  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-pulse-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="max-w-md w-full text-center space-y-6">
        {/* Loading State */}
        {status === "loading" && (
          <>
            <div className="w-16 h-16 bg-pulse-100 rounded-full flex items-center justify-center mx-auto">
              <Loader2 className="w-8 h-8 text-pulse-500 animate-spin" />
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
                className="w-2 h-2 bg-pulse-500 rounded-full animate-bounce"
                style={{ animationDelay: "0ms" }}
              />
              <div
                className="w-2 h-2 bg-pulse-500 rounded-full animate-bounce"
                style={{ animationDelay: "150ms" }}
              />
              <div
                className="w-2 h-2 bg-pulse-500 rounded-full animate-bounce"
                style={{ animationDelay: "300ms" }}
              />
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
              <p className="text-muted-foreground">
                {t("success.description")}
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
