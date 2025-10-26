// hype-hire/vercel/components/Footer.tsx
"use client";

import React from "react";
import { useTranslation } from "react-i18next";

const Footer = () => {
  const { t, i18n } = useTranslation("footer");
  const localePrefix = `/${i18n.language}`;

  return (
    <footer className="border-t mt-8 pt-4 pb-8">
      <div className="max-w-6xl mx-auto px-4 text-center text-sm text-gray-600">
        <a href={`${localePrefix}/privacy`} className="hover:text-blue-600">
          {t("privacyPolicy")}
        </a>
        {" • "}
        <a href={`${localePrefix}/terms`} className="hover:text-blue-600">
          {t("termsOfService")}
        </a>
        {" • "}
        <span>{t("copyright")}</span>
      </div>
    </footer>
  );
};

export default Footer;
