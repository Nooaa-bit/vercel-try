//terms/page.tsx
"use client";

import { useTranslation } from "react-i18next";

export default function TermsPage() {
  const { t } = useTranslation("terms");

  return (
    <div className="pt-10 pb-8">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-6">{t("title")}</h1>

        <section className="prose max-w-none space-y-6">
          <div>
            <h2 className="text-xl font-semibold mb-2">
              {t("acceptance.title")}
            </h2>
            <p>{t("acceptance.content")}</p>
          </div>

          <div>
            <h2 className="text-xl font-semibold mb-2">
              {t("services.title")}
            </h2>
            <p>{t("services.content")}</p>
          </div>

          <div>
            <h2 className="text-xl font-semibold mb-2">
              {t("responsibilities.title")}
            </h2>
            <ul className="list-disc pl-6 space-y-1">
              <li>{t("responsibilities.item1")}</li>
              <li>{t("responsibilities.item2")}</li>
              <li>{t("responsibilities.item3")}</li>
              <li>{t("responsibilities.item4")}</li>
            </ul>
          </div>

          <div>
            <h2 className="text-xl font-semibold mb-2">
              {t("termination.title")}
            </h2>
            <p>{t("termination.content")}</p>
          </div>

          <div>
            <h2 className="text-xl font-semibold mb-2">{t("contact.title")}</h2>
            <p>{t("contact.email")}</p>
            <p>
              <strong>{t("contact.updated")}</strong> {t("contact.date")}
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
