"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";
import { useTranslation } from "react-i18next";
import "@/lib/i18n";

type Language = "en" | "el";

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
}

const LanguageContext = createContext<LanguageContextType | undefined>(
  undefined
);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>("en");
  const { i18n } = useTranslation();

  useEffect(() => {
    // Load from localStorage on mount
    const saved = localStorage.getItem("language") as Language | null;
    if (saved && (saved === "en" || saved === "el")) {
      setLanguageState(saved);
      i18n.changeLanguage(saved);
    }
  }, [i18n]);

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    i18n.changeLanguage(lang);
    localStorage.setItem("language", lang);
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage }}>
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
