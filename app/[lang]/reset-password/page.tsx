//hype-hire/vercel/app/[lang]/reset-password/page.tsx
"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import Link from "next/link";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CheckCircle, AlertCircle, Eye, EyeOff } from "lucide-react";

export default function ResetPasswordPage() {
  const { t, ready } = useTranslation("reset-password");
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  // Extract language from pathname
  const pathMatch = pathname.match(/^\/(en|el)(?=\/|$)/);
  const lang = (pathMatch?.[1] as "en" | "el") ?? "en";

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [tokenValid, setTokenValid] = useState<boolean | null>(null);

  // Validate token on page load
  useEffect(() => {
    const validateToken = async () => {
      if (!token) {
        toast.error(t("errorInvalidLink") || "Invalid or missing reset link");
        router.push("/");
        return;
      }

      try {
        // Call API to validate the token
        const response = await fetch("/api/password-reset/validate", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ token }),
        });

        const result = await response.json();

        if (!response.ok) {
          if (result.code === "TOKEN_EXPIRED") {
            toast.error(
              t("errorTokenExpired") ||
                "This reset link has expired. Please request a new one."
            );
          } else if (result.code === "TOKEN_NOT_FOUND") {
            toast.error(
              t("errorInvalidLink") ||
                "This reset link is invalid. Please request a new one."
            );
          } else {
            toast.error(result.error || "Invalid reset link");
          }
          setTokenValid(false);
          router.push("/");
          return;
        }

        // Token is valid
        setTokenValid(true);
      } catch (err) {
        console.error("Token validation error:", err);
        toast.error("Failed to validate reset link");
        setTokenValid(false);
        router.push("/");
      }
    };

    validateToken();
  }, [token, router, t]);

  // Loading skeleton while translations load or token validates
  if (!ready || tokenValid === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-lg shadow-elegant">
          <CardHeader className="text-center space-y-2">
            <div className="h-8 bg-gray-200 rounded w-2/3 mx-auto animate-pulse" />
            <div className="h-4 bg-gray-200 rounded w-1/2 mx-auto animate-pulse" />
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              <div className="h-10 bg-gray-200 rounded animate-pulse" />
              <div className="h-32 bg-gray-200 rounded animate-pulse" />
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Token is invalid, don't show the form
  if (!tokenValid) {
    return null; // Redirecting in useEffect
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-lg">
          <CardHeader className="text-center">
            <div className="w-16 h-16 bg-pulse-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-8 h-8 text-pulse-500" />
            </div>
            <CardTitle className="text-2xl">
              {t("successTitle") || "Password Reset"}
            </CardTitle>
            <CardDescription>
              {t("successMessage") ||
                "Your password has been reset successfully"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                {t("redirectingMessage") || "Redirecting to login page..."}
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      </div>
    );
  }

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    if (!password.trim()) {
      toast.error(t("errorPasswordRequired") || "Password is required");
      return;
    }

    if (password.length < 6) {
      toast.error(
        t("errorPasswordTooShort") || "Password must be at least 6 characters"
      );
      return;
    }

    if (!confirmPassword.trim()) {
      toast.error(
        t("errorConfirmPasswordRequired") || "Please confirm your password"
      );
      return;
    }

    if (password !== confirmPassword) {
      toast.error(t("errorPasswordMismatch") || "Passwords do not match");
      return;
    }

    setLoading(true);

    try {
      // Call the verify API to update password
      const response = await fetch("/api/password-reset/verify", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          token,
          newPassword: password,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        if (result.code === "TOKEN_EXPIRED") {
          toast.error(
            t("errorTokenExpired") ||
              "This reset link has expired. Please request a new one."
          );
          router.push("/");
        } else if (result.code === "TOKEN_NOT_FOUND") {
          toast.error(
            t("errorInvalidLink") ||
              "This reset link is invalid. Please request a new one."
          );
          router.push("/");
        } else {
          toast.error(result.error || t("errorResettingPassword"));
        }
        return;
      }

      // Success!
      setSuccess(true);
      console.log("✅ Password reset successful");

      // Redirect to login after 1 seconds using current language
      setTimeout(() => {
        router.push(`/${lang}/login`);
      }, 1000);
    } catch (err) {
      console.error("Password reset error:", err);
      toast.error(t("errorResettingPassword") || "Failed to reset password");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-lg shadow-elegant">
        <CardHeader className="text-center space-y-2">
          <CardTitle className="text-3xl font-display">
            {t("title") || "Reset Your Password"}
          </CardTitle>
          <CardDescription>
            {t("description") || "Enter your new password below"}
          </CardDescription>
        </CardHeader>

        <CardContent>
          <form onSubmit={handlePasswordReset} noValidate className="space-y-4">
            {/* New Password */}
            <div className="space-y-2">
              <Label htmlFor="password">
                {t("passwordLabel") || "New Password"}
              </Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={t("passwordPlaceholder") || "Enter new password"}
                  className="focus-visible:ring-pulse-500 pr-10"
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                  tabIndex={-1}
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
              <p className="text-xs text-muted-foreground">
                {t("passwordHint") || "At least 8 characters"}
              </p>
            </div>

            {/* Confirm Password */}
            <div className="space-y-2">
              <Label htmlFor="confirm-password">
                {t("confirmLabel") || "Confirm Password"}
              </Label>
              <div className="relative">
                <Input
                  id="confirm-password"
                  type={showConfirm ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder={
                    t("confirmPlaceholder") || "Confirm new password"
                  }
                  className="focus-visible:ring-pulse-500 pr-10"
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm(!showConfirm)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                  tabIndex={-1}
                >
                  {showConfirm ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              className="w-full bg-pulse-500 hover:bg-pulse-600"
              disabled={loading}
            >
              {loading
                ? t("resetting") || "Resetting..."
                : t("resetButton") || "Reset Password"}
            </Button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-xs text-muted-foreground">
              {t("rememberedPassword") || "Remember your password?"}{" "}
              <Link
                href={`/${lang}/login`}
                className="text-blue-600 hover:text-blue-700 hover:underline"
              >
                {t("backToLogin") || "Back to login"}
              </Link>
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
