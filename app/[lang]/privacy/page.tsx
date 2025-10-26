"use client";

import { useTranslation } from "react-i18next";

export default function PrivacyPage() {
  const { t, ready } = useTranslation("privacy");

  // Loading state while translations load
  if (!ready) {
    return (
      <div className="min-h-screen bg-background pt-24 pb-12">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-card rounded-lg shadow-md p-8 border border-border">
            <div className="flex items-center justify-center h-96">
              <div className="w-8 h-8 border-4 border-pulse-500 border-t-transparent rounded-full animate-spin" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pt-24 pb-12">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-card rounded-lg shadow-md p-8 border border-border">
          <h1 className="text-3xl font-bold text-foreground mb-6">
            {t("title")}
          </h1>

          <div className="prose prose-blue max-w-none dark:prose-invert">
            <p className="text-muted-foreground mb-4">
              {t("updated")}: {new Date().toLocaleDateString()}
            </p>

            <h2 className="text-2xl font-semibold text-foreground mt-8 mb-4">
              {t("sections.collect.title")}
            </h2>
            <p className="text-foreground mb-4">
              {t("sections.collect.content")}
            </p>

            <h2 className="text-2xl font-semibold text-foreground mt-8 mb-4">
              {t("sections.use.title")}
            </h2>
            <p className="text-foreground mb-4">{t("sections.use.content")}</p>

            <h2 className="text-2xl font-semibold text-foreground mt-8 mb-4">
              {t("sections.security.title")}
            </h2>
            <p className="text-foreground mb-4">
              {t("sections.security.content")}
            </p>

            <h2 className="text-2xl font-semibold text-foreground mt-8 mb-4">
              {t("sections.contact.title")}
            </h2>
            <p className="text-foreground">{t("sections.contact.content")}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
