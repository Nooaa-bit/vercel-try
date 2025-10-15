"use client";

import { useTranslation } from "react-i18next";

export default function PrivacyPage() {
  const { t } = useTranslation("privacy");

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white rounded-lg shadow-md p-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-6">
            {t("title")}
          </h1>

          <div className="prose prose-blue max-w-none">
            <p className="text-gray-600 mb-4">
              {t("updated")}: {new Date().toLocaleDateString()}
            </p>

            <h2 className="text-2xl font-semibold text-gray-900 mt-8 mb-4">
              {t("sections.collect.title")}
            </h2>
            <p className="text-gray-700 mb-4">
              {t("sections.collect.content")}
            </p>

            <h2 className="text-2xl font-semibold text-gray-900 mt-8 mb-4">
              {t("sections.use.title")}
            </h2>
            <p className="text-gray-700 mb-4">{t("sections.use.content")}</p>

            <h2 className="text-2xl font-semibold text-gray-900 mt-8 mb-4">
              {t("sections.security.title")}
            </h2>
            <p className="text-gray-700 mb-4">
              {t("sections.security.content")}
            </p>

            <h2 className="text-2xl font-semibold text-gray-900 mt-8 mb-4">
              {t("sections.contact.title")}
            </h2>
            <p className="text-gray-700">{t("sections.contact.content")}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
