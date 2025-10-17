//hype-hire/vercel/app/[lang]/reset-password/page.tsx
"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";

export default function ResetPassword() {
  const { t } = useTranslation("reset-pass");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [isValidSession, setIsValidSession] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    // Check if this is a valid password recovery session
    const checkSession = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session) {
        setIsValidSession(true);
      } else {
        // No valid session, redirect to login
        router.push("/login");
      }
    };

    checkSession();

    // Listen for auth state changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === "PASSWORD_RECOVERY") {
        setIsValidSession(true);
      }
    });

    return () => subscription.unsubscribe();
  }, [supabase.auth, router]);

  const handlePasswordUpdate = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password !== confirmPassword) {
      alert(t("errorPasswordMismatch"));
      return;
    }

    if (password.length < 4) {
      alert(t("errorPasswordTooShort"));
      return;
    }

    setLoading(true);

    try {
      // Step 1: Update the password in auth.users (Supabase handles this)
      const { error: passwordError } = await supabase.auth.updateUser({
        password: password,
      });

      if (passwordError) throw passwordError;

      // Step 2: Update has_password field in YOUR public.user table
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        const { error: dbError } = await supabase
          .from("user") // Your public.user table
          .update({ has_password: true })
          .eq("auth_user_id", user.id);

        if (dbError) {
          console.error("Error updating user table:", dbError);
          // Don't fail the whole process if this fails
        }
      }

      alert(t("successPasswordUpdated"));
      router.push("/dashboard");
    } catch (error) {
      alert(t("errorUpdatingPassword") + (error as Error).message);
    } finally {
      setLoading(false);
    }
  };

  if (!isValidSession) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">{t("validatingSession")}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="max-w-md w-full bg-white rounded-lg shadow p-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">{t("title")}</h1>

        <form onSubmit={handlePasswordUpdate} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t("newPassword")}
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder={t("newPasswordPlaceholder")}
              required
              minLength={4}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t("confirmPassword")}
            </label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder={t("confirmPasswordPlaceholder")}
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? t("updating") : t("updatePassword")}
          </button>
        </form>

        <div className="mt-4 text-center">
          <button
            onClick={() => router.push("/dashboard")}
            className="text-sm text-gray-600 hover:text-gray-800"
          >
            {t("backToDashboard")}
          </button>
        </div>
      </div>
    </div>
  );
}
