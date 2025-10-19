"use client";

import { useTranslation } from "react-i18next";

export default function TermsPage() {
  const { t } = useTranslation("terms");

  return (
    <div className="min-h-screen bg-background pt-24 pb-12">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-card rounded-lg shadow-md p-8 border border-border">
          <h1 className="text-3xl font-bold text-foreground mb-6">
            {t("title")}
          </h1>

          <section className="max-w-none space-y-6">
            <div>
              <h2 className="text-2xl font-semibold text-foreground mb-4">
                {t("acceptance.title")}
              </h2>
              <p className="text-foreground">{t("acceptance.content")}</p>
            </div>

            <div>
              <h2 className="text-2xl font-semibold text-foreground mb-4">
                {t("services.title")}
              </h2>
              <p className="text-foreground">{t("services.content")}</p>
            </div>

            <div>
              <h2 className="text-2xl font-semibold text-foreground mb-4">
                {t("responsibilities.title")}
              </h2>
              <ul className="list-disc pl-6 space-y-2 text-foreground">
                <li>{t("responsibilities.item1")}</li>
                <li>{t("responsibilities.item2")}</li>
                <li>{t("responsibilities.item3")}</li>
                <li>{t("responsibilities.item4")}</li>
              </ul>
            </div>

            <div>
              <h2 className="text-2xl font-semibold text-foreground mb-4">
                {t("termination.title")}
              </h2>
              <p className="text-foreground">{t("termination.content")}</p>
            </div>

            <div>
              <h2 className="text-2xl font-semibold text-foreground mb-4">
                {t("contact.title")}
              </h2>
              <p className="text-foreground">{t("contact.email")}</p>
              <p className="text-muted-foreground mt-4">
                <strong>{t("contact.updated")}</strong> {t("contact.date")}
              </p>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
