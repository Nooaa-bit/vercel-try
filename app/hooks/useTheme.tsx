//hype-hire/vercel/app/hooks/useTheme.tsx
"use client";
import React, { createContext, useContext, useEffect, useState } from "react";

type Theme = "light" | "dark" | "system";
type Ctx = { theme: Theme; setTheme: (t: Theme) => void; toggle: () => void };

const ThemeCtx = createContext<Ctx | null>(null);
export function useTheme() {
  const ctx = useContext(ThemeCtx);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>("system");
  const apply = (t: Theme) => {
    const root = document.documentElement;
    const resolved =
      t === "system"
        ? window.matchMedia("(prefers-color-scheme: dark)").matches
          ? "dark"
          : "light"
        : t;
    root.classList.toggle("dark", resolved === "dark");
  };
  useEffect(() => apply(theme), [theme]);
  const toggle = () => setTheme((t) => (t === "dark" ? "light" : "dark"));
  return (
    <ThemeCtx.Provider value={{ theme, setTheme, toggle }}>
      {children}
    </ThemeCtx.Provider>
  );
}
