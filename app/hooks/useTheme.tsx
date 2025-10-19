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

// Helper to get initial theme
function getInitialTheme(): Theme {
  if (typeof window === "undefined") return "light";
  const stored = localStorage.getItem("theme");
  return stored === "dark" ? "dark" : "light";
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [theme, setTheme] = useState<Theme>(getInitialTheme);

  // Check if current page is homepage
  const isHomePage =
    pathname === "/" ||
    pathname === "/en" ||
    pathname === "/el" ||
    pathname === "/en/" ||
    pathname === "/el/";

  useEffect(() => {
    // Apply dark mode ONLY if theme is dark AND not on homepage
    const shouldApplyDark = theme === "dark" && !isHomePage;
    document.documentElement.classList.toggle("dark", shouldApplyDark);

    // Always save theme preference (so it persists when leaving homepage)
    localStorage.setItem("theme", theme);
  }, [theme, isHomePage]);

  const toggle = () => setTheme((prev) => (prev === "dark" ? "light" : "dark"));

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggle }}>
      {children}
    </ThemeContext.Provider>
  );
}
