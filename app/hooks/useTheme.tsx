//hype-hire/vercel/app/hooks/useTheme.tsx
"use client";
import { createContext, useContext, useEffect, useState } from "react";
import { usePathname } from "next/navigation";

type Theme = "light" | "dark";
type ThemeContext = {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggle: () => void;
};

const ThemeContext = createContext<ThemeContext | null>(null);

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("useTheme must be used within ThemeProvider");
  return context;
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [theme, setTheme] = useState<Theme>("light");
  const [mounted, setMounted] = useState(false);

  // Load theme from localStorage after mount (client-side only)
  useEffect(() => {
    const stored = localStorage.getItem("theme");
    if (stored === "dark") setTheme("dark");
    setMounted(true);
  }, []);

  // Check if current page is homepage (simple regex, no useMemo needed)
  //import { useMemo } from "react";
  // const isHomePage = useMemo(() => {
  const isHomePage = /^\/(en|el)?\/?$/.test(pathname);

  // Apply dark mode to DOM
  useEffect(() => {
    if (!mounted) return;
    const shouldApplyDark = theme === "dark" && !isHomePage;
    document.documentElement.classList.toggle("dark", shouldApplyDark);
  }, [theme, isHomePage, mounted]);

  // Save theme preference (separate effect for clarity)
  useEffect(() => {
    if (mounted) {
      localStorage.setItem("theme", theme);
    }
  }, [theme, mounted]);

  const toggle = () => setTheme((prev) => (prev === "dark" ? "light" : "dark"));

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggle }}>
      {children}
    </ThemeContext.Provider>
  );
}
