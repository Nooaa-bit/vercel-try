// hype-hire/vercel/components/Footer.tsx
"use client";

import React from "react";
import { useTranslation } from "react-i18next";
import { usePathname } from "next/navigation";

const Footer = () => {
  const { t } = useTranslation("footer");
  const pathname = usePathname();

  // Extract "/en" or "/el" from the current path; default to "/en" if missing
  const localePrefix = (() => {
    const match = pathname?.match(/^\/(en|el)(?=\/|$)/);
    return match ? `/${match[1]}` : "/en";
  })();

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
