//hype-hire/web/components/LanguageSwitcher.tsx
"use client";

import { useLanguage } from "@/lib/LanguageContext";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ChevronDown, RefreshCw } from "lucide-react";

const locales = [
  { code: "en", label: "EN", flag: "🇺🇸", name: "English" },
  { code: "el", label: "ΕΛ", flag: "🇬🇷", name: "Ελληνικά" },
];

interface LanguageSwitcherProps {
  variant?: "buttons" | "dropdown";
}

export default function LanguageSwitcher({
  variant = "dropdown",
}: LanguageSwitcherProps) {
  const { language, setLanguage, loading } = useLanguage();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const switchLanguage = (newLocale: "en" | "el") => {
    if (newLocale === language) return;

    // Extract current language from pathname
    const pathMatch = pathname.match(/^\/(en|el)(?=\/|$)/);
    const currentLang = (pathMatch?.[1] as "en" | "el") ?? "en";

    // Replace language in pathname
    const newPathname = pathname.replace(/^\/(en|el)/, `/${newLocale}`);

    // Preserve all query parameters
    const queryString = searchParams.toString();
    const fullUrl = queryString ? `${newPathname}?${queryString}` : newPathname;

    // Update language context
    setLanguage(newLocale);

    // Navigate to new URL with preserved query params
    router.push(fullUrl);
  };

  const currentLocale = locales.find((l) => l.code === language);

  if (variant === "buttons") {
    return (
      <div className="flex gap-2">
        {locales.map((loc) => (
          <Button
            key={loc.code}
            onClick={() => switchLanguage(loc.code as "en" | "el")}
            disabled={loading}
            variant={language === loc.code ? "default" : "outline"}
            size="sm"
            className="flex items-center gap-2"
          >
            <span>{loc.flag}</span>
            <span>{loc.label}</span>
            {loading && <RefreshCw className="h-3 w-3 animate-spin" />}
          </Button>
        ))}
      </div>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          disabled={loading}
          className="flex items-center gap-2"
        >
          <span>{currentLocale?.flag}</span>
          <span>{currentLocale?.label}</span>
          {loading ? (
            <RefreshCw className="h-3 w-3 animate-spin" />
          ) : (
            <ChevronDown className="h-3 w-3" />
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {locales.map((loc) => (
          <DropdownMenuItem
            key={loc.code}
            onClick={() => switchLanguage(loc.code as "en" | "el")}
            className="flex items-center gap-3"
            disabled={loading}
          >
            <span>{loc.flag}</span>
            <div>
              <div className="font-medium">{loc.label}</div>
              <div className="text-xs text-muted-foreground">{loc.name}</div>
            </div>
            {language === loc.code && (
              <div className="ml-auto">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              </div>
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
