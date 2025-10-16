"use client";

import React from "react";
import { useLanguage } from "@/lib/LanguageContext";

const translations = {
  en: {
    privacyPolicy: "Privacy Policy",
    termsOfService: "Terms of Service",
    copyright: "© 2025 HypeHire",
  },
  el: {
    privacyPolicy: "Πολιτική Απορρήτου",
    termsOfService: "Όροι Χρήσης",
    copyright: "© 2025 HypeHire",
  },
};

const Footer = () => {
  const { language } = useLanguage();

  const t =
    translations[language as keyof typeof translations] || translations.en;

  return (
    <footer className="border-t mt-8 pt-4 pb-8">
      <div className="max-w-6xl mx-auto px-4 text-center text-sm text-gray-600">
        <a href={`/${language}/privacy`} className="hover:text-blue-600">
          {t.privacyPolicy}
        </a>
        {" • "}
        <a href={`/${language}/terms`} className="hover:text-blue-600">
          {t.termsOfService}
        </a>
        {" • "}
        <span>{t.copyright}</span>
      </div>
    </footer>
  );
};

export default Footer;
