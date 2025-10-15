// vercel/lib/LanguageContext.tsx
"use client";
import { createContext, useContext, useEffect, ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { usePathname, useRouter } from "next/navigation";
import "@/lib/i18n";

type Language = "en" | "el";

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
}

const LanguageContext = createContext<LanguageContextType | undefined>(
  undefined
);

// Type guard to narrow string -> Language
function isLanguage(lang: string): lang is Language {
  return lang === "en" || lang === "el";
}

export function LanguageProvider({
  children,
  lang, // now accepts string from server/layout
}: {
  children: ReactNode;
  lang: string; // changed from Language to string
}) {
  const { i18n } = useTranslation();
  const pathname = usePathname();
  const router = useRouter();

  // Normalize to a valid Language (default to 'en')
  const normalizedLang: Language = isLanguage(lang) ? lang : "en";

  useEffect(() => {
    i18n.changeLanguage(normalizedLang);
    document.cookie = `language=${normalizedLang}; path=/; max-age=31536000`;
  }, [normalizedLang, i18n]);

  const setLanguage = (newLang: Language) => {
    if (newLang === normalizedLang) return;
    // Replace only the first segment /en or /el
    const newPathname = pathname.replace(/^\/(en|el)(?=\/|$)/, `/${newLang}`);
    router.push(newPathname);
  };

  return (
    <LanguageContext.Provider value={{ language: normalizedLang, setLanguage }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error("useLanguage must be used within LanguageProvider");
  }
  return context;
}
