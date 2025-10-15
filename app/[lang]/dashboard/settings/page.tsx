"use client";

import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useLanguage } from "@/lib/LanguageContext";
import type { User } from "@supabase/supabase-js";

interface DbUser {
  id: number;
  authUserId: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  hasPassword: boolean;
  createdAt: Date;
}

export default function SettingsPage() {
  const [user, setUser] = useState<User | null>(null);
  const [dbUser, setDbUser] = useState<DbUser | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const supabase = createClient();
  const { t } = useTranslation("settings");
  const { language } = useLanguage();

  useEffect(() => {
    async function getUser() {
      const {
        data: { user },
        error,
      } = await supabase.auth.getUser();

      if (error || !user) {
        router.push(`/${language}/login`);
        return;
      }

      setUser(user);

      // Fetch corresponding Prisma user record
      const response = await fetch("/api/user");
      if (response.ok) {
        const data = await response.json();
        setDbUser(data.user);
      }

      setLoading(false);
    }

    getUser();
  }, [router, supabase, language]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-600">Loading...</div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white rounded-lg shadow-md p-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-6">
            {t("title")}
          </h1>

          <div className="space-y-6">
            <div className="border-b pb-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">
                {t("account.title")}
              </h2>
              <div className="space-y-3">
                <div>
                  <span className="text-sm font-medium text-gray-500">
                    {t("account.email")}:
                  </span>
                  <p className="text-gray-900">{user.email}</p>
                </div>
                <div>
                  <span className="text-sm font-medium text-gray-500">
                    Auth {t("account.userId")}:
                  </span>
                  <p className="text-gray-900 font-mono text-sm">{user.id}</p>
                </div>
                {dbUser && (
                  <>
                    <div>
                      <span className="text-sm font-medium text-gray-500">
                        Database User ID:
                      </span>
                      <p className="text-gray-900 font-mono text-sm">
                        {dbUser.id}
                      </p>
                    </div>
                    <div>
                      <span className="text-sm font-medium text-gray-500">
                        Has Password:
                      </span>
                      <p className="text-gray-900">
                        {dbUser.hasPassword ? "Yes" : "No (OAuth)"}
                      </p>
                    </div>
                  </>
                )}
                <div>
                  <span className="text-sm font-medium text-gray-500">
                    {t("account.created")}:
                  </span>
                  <p className="text-gray-900">
                    {new Date(user.created_at).toLocaleDateString()}
                  </p>
                </div>
              </div>
            </div>

            <div className="border-b pb-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">
                {t("profile.title")}
              </h2>
              <p className="text-gray-600 mb-4">{t("profile.coming")}</p>
            </div>

            <div>
              <h2 className="text-xl font-semibold text-gray-900 mb-4">
                {t("preferences.title")}
              </h2>
              <p className="text-gray-600">{t("preferences.coming")}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
