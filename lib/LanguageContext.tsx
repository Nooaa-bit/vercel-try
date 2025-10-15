//vercel/lib/LanguageContext.tsx
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

export function LanguageProvider({
  children,
  lang,
}: {
  children: ReactNode;
  lang: Language;
}) {
  const { i18n } = useTranslation();
  const pathname = usePathname();
  const router = useRouter();

  // This effect runs whenever lang changes
  useEffect(() => {
    // Immediately change i18n language
    i18n.changeLanguage(lang);
    // Set cookie to persist preference
    document.cookie = `language=${lang}; path=/; max-age=31536000`;
  }, [lang, i18n]);

  const setLanguage = (newLang: Language) => {
    // Only change if different
    if (newLang === lang) return;

    // Replace language in current path
    const newPathname = pathname.replace(`/${lang}`, `/${newLang}`);
    router.push(newPathname);
  };

  return (
    <LanguageContext.Provider value={{ language: lang, setLanguage }}>
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
