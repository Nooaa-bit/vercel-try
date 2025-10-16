// vercel/lib/LanguageContext.tsx
"use client";
import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";
import { useTranslation } from "react-i18next";
import { usePathname, useRouter } from "next/navigation";
import "@/lib/i18n";

type Language = "en" | "el";

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  loading: boolean;
}

const LanguageContext = createContext<LanguageContextType | undefined>(
  undefined
);

function isLanguage(lang: string): lang is Language {
  return lang === "en" || lang === "el";
}

export function LanguageProvider({
  children,
  lang,
}: {
  children: ReactNode;
  lang: string;
}) {
  const { i18n } = useTranslation();
  const pathname = usePathname();
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const normalizedLang: Language = isLanguage(lang) ? lang : "en";

  useEffect(() => {
    i18n.changeLanguage(normalizedLang);
    document.cookie = `language=${normalizedLang}; path=/; max-age=31536000`;
  }, [normalizedLang, i18n]);

  const setLanguage = async (newLang: Language) => {
    if (newLang === normalizedLang) return;

    try {
      setLoading(true);
      
      // Save current scroll position before navigation
      const scrollY = window.scrollY;
      
      // Create a unique key for this page's scroll position
      const scrollKey = `scrollPosition_${pathname}`;
      sessionStorage.setItem(scrollKey, scrollY.toString());

      // Update the URL without triggering a full page reload
      const newPathname = pathname.replace(/^\/(en|el)(?=\/|$)/, `/${newLang}`);
      await router.push(newPathname, { scroll: false });
      
      // Wait for the next tick to ensure the page has updated
      setTimeout(() => {
        // Restore scroll position using the stored key
        const savedPosition = sessionStorage.getItem(scrollKey);
        if (savedPosition) {
          window.scrollTo(0, parseInt(savedPosition));
          sessionStorage.removeItem(scrollKey);
        }
      }, 0);
      
    } catch (error) {
      console.error('Error changing language:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <LanguageContext.Provider
      value={{ language: normalizedLang, setLanguage, loading }}
    >
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
