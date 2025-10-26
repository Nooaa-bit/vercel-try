// /web/components/Navbar.tsx
"use client";

import React from "react";
import { cn } from "@/lib/utils";
import { Menu, X, LogOut, User, Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useRouter, usePathname } from "next/navigation";
import { useTranslation } from "react-i18next";
import LanguageSwitcher from "@/components/LanguageSwitcher";

// Custom hooks
import { useAuth } from "@/app/hooks/useAuth";
import { useTheme } from "@/app/hooks/useTheme";
import { useScrollPosition } from "@/app/hooks/useScrollPosition";
import { useMobileMenu } from "@/app/hooks/useMobileMenu";

const Navbar = () => {
  const { t, i18n, ready } = useTranslation("nav");
  const { user, loading: authLoading, signIn, signOut } = useAuth();
  const { theme, toggle: toggleTheme } = useTheme();
  const isScrolled = useScrollPosition(10);
  const { isOpen: isMenuOpen, toggle: toggleMenu, close: closeMenu, scrollToTop } = useMobileMenu();

  const router = useRouter();
  const pathname = usePathname();

  // Extract lang from pathname; middleware guarantees /en or /el
  const match = pathname.match(/^\/(en|el)(?=\/|$)/);
  const lang = (match?.[1] as "en" | "el") ?? "en";

  const homePath = `/${lang}`;
  const isHomePage = /^\/(en|el)?\/?$/.test(pathname);
  const isDashboardPage = pathname.includes("dashboard");
  const darkMode = theme === "dark";

  // Smooth scroll to an element id (same-page case)
  const scrollToId = (id: "features" | "details") => {
    const el = typeof document !== "undefined" ? document.getElementById(id) : null;
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "start", inline: "nearest" });
    if (typeof window !== "undefined") {
      const url = `${homePath}#${id}`;
      if (window.location.hash !== `#${id}`) {
        window.history.replaceState(null, "", url);
      }
    }
  };

  // Click handler factory for hash links (same-page)
  const handleHashNav =
    (id: "features" | "details") =>
    (e: React.MouseEvent<HTMLAnchorElement>) => {
      if (!isHomePage) return;
      e.preventDefault();
      closeMenu();
      requestAnimationFrame(() => scrollToId(id));
    };

  // Home click behaves like scroll-to-top when on the homepage
  const handleHomeClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (!isHomePage) return;
    e.preventDefault();
    closeMenu();
    requestAnimationFrame(() => scrollToTop());
  };

  // Build nav items only if NOT on any dashboard page - NO USEMEMO
  const navItems = isDashboardPage ? [] : [
    { label: t("home"), href: homePath, onClick: handleHomeClick },
    { label: t("about"), href: `${homePath}#features`, onClick: handleHashNav("features") },
    { label: t("contact"), href: `${homePath}#details`, onClick: handleHashNav("details") },
  ];

  const handleLogoClick = (e: React.MouseEvent) => {
    e.preventDefault();
    if (isHomePage) {
      scrollToTop();
    } else {
      router.push(homePath);
    }
  };

  const handleDashboardClick = (e: React.MouseEvent) => {
    e.preventDefault();
    router.push(`/${lang}/dashboard`);
  };

  const renderAuthSection = (isMobile = false) => {
    if (authLoading) {
      return (
        <div className="flex items-center justify-center space-x-2">
          <div className="w-4 h-4 border-2 border-pulse-500 border-t-transparent rounded-full animate-spin" />
          {isMobile && <span className="text-sm text-gray-600">{t("loading")}</span>}
        </div>
      );
    }

    if (user) {
      return (
        <div
          className={cn(
            "flex items-center",
            isMobile ? "flex-col space-y-4 w-full" : "gap-1.5 lg:gap-2 xl:gap-3"
          )}
        >
          {isMobile && (
            <div className="flex items-center space-x-3 justify-center">
              <div className="relative">
                <div className="w-10 h-10 bg-gradient-to-br from-pulse-500 to-pulse-600 rounded-full flex items-center justify-center text-white font-semibold text-sm shadow-md">
                  {user.user_metadata?.first_name?.[0]?.toUpperCase() || user.email?.[0]?.toUpperCase()}
                </div>
                <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 rounded-full border-2 border-white shadow-sm" />
              </div>
              <div>
                <div className="text-sm font-medium text-gray-900">
                  {user.user_metadata?.first_name} {user.user_metadata?.last_name}
                </div>
                <div className="text-xs text-gray-500">{user.email}</div>
              </div>
            </div>
          )}

          {!isMobile && (
            <>
              <div className="relative">
                <div className="w-7 h-7 lg:w-8 lg:h-8 bg-gradient-to-br from-pulse-500 to-pulse-600 rounded-full flex items-center justify-center text-white font-semibold text-xs shadow-md">
                  {user.user_metadata?.first_name?.[0]?.toUpperCase() || user.email?.[0]?.toUpperCase()}
                </div>
                <div className="absolute -bottom-0.5 -right-0.5 w-2 h-2 lg:w-2.5 lg:h-2.5 bg-green-500 rounded-full border-2 border-white shadow-sm" />
              </div>
              <div className="hidden xl:block">
                <div className="text-sm font-medium text-gray-900">
                  {user.user_metadata?.first_name} {user.user_metadata?.last_name}
                </div>
              </div>
            </>
          )}

          <Button
            variant="outline"
            size="sm"
            onClick={isMobile ? () => { signOut(); closeMenu(); } : signOut}
            className={cn(
              "border-red-300 text-red-600 hover:bg-red-50 hover:border-red-300",
              isMobile ? "w-full" : "bg-transparent text-xs lg:text-sm px-2 lg:px-3 h-8 lg:h-9"
            )}
          >
            <LogOut className={cn("w-3 h-3 lg:w-4 lg:h-4", !isMobile && "lg:mr-2")} />
            <span className={isMobile ? "" : "hidden lg:inline"}>{t("signOut")}</span>
          </Button>
        </div>
      );
    }

    return (
      <Button
        variant="outline"
        size="sm"
        onClick={isMobile ? () => { signIn(); closeMenu(); } : signIn}
        className={cn(
          "border-pulse-500 text-pulse-500 hover:bg-pulse-500 hover:text-white transition-all duration-300",
          isMobile ? "w-full bg-pulse-500 text-white" : "bg-transparent text-xs lg:text-sm px-2 lg:px-3 h-8 lg:h-9"
        )}
      >
        <User className={cn("w-3 h-3 lg:w-4 lg:h-4", !isMobile && "lg:mr-2")} />
        <span className={isMobile ? "" : "hidden lg:inline"}>{t("login")}</span>
      </Button>
    );
  };

  if (!ready) {
    return (
      <header className="fixed top-0 left-0 right-0 z-50 py-2 sm:py-3 md:py-4 bg-white/80 backdrop-blur-md">
        <div className="container flex items-center justify-between px-4 sm:px-6 lg:px-8">
          <img src="/logo.png" alt="Hype Hire Logo" className="h-8 sm:h-9 md:h-10 lg:h-12 flex-shrink-0" />
          <div className="flex items-center space-x-2">
            <div className="w-4 h-4 border-2 border-pulse-500 border-t-transparent rounded-full animate-spin" />
          </div>
        </div>
      </header>
    );
  }

  return (
    <>
      <header
        className={cn(
          "fixed top-0 left-0 right-0 z-50 py-2 sm:py-3 md:py-4 transition-all duration-300",
          isDashboardPage ? "bg-background shadow-sm" : isScrolled ? "bg-white/60 backdrop-blur-lg shadow-sm" : "bg-transparent"
        )}
      >
        <div className="container flex items-center justify-between gap-2 md:gap-4 px-4 sm:px-6 lg:px-8">
          {/* Logo */}
          <a
            href={homePath}
            className="flex items-center space-x-2 cursor-pointer flex-shrink-0"
            onClick={handleLogoClick}
            aria-label="Hype Hire"
          >
            <img src="/logo.png" alt="Hype Hire Logo" className="h-8 sm:h-9 md:h-10 lg:h-12" />
          </a>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-2 lg:gap-4 xl:gap-6">
            {/* Nav Links (hidden on dashboard pages) */}
            <nav className="flex items-center gap-3 lg:gap-5 xl:gap-6">
              {navItems.map((item) => (
                <a
                  key={item.label}
                  href={item.href}
                  className="nav-link text-xs lg:text-sm xl:text-base whitespace-nowrap"
                  onClick={item.onClick}
                >
                  {item.label}
                </a>
              ))}
            </nav>

            {/* Dashboard Link */}
            {user && !isDashboardPage && (
              <a
                href="#"
                className="nav-link text-xs lg:text-sm xl:text-base whitespace-nowrap flex items-center gap-1"
                onClick={handleDashboardClick}
              >
                <span className="text-sm lg:text-base">📊</span>
                <span>{t("Dashboard")}</span>
              </a>
            )}

            {/* Dark Mode Toggle */}
            {!isHomePage && (
              <div className="flex items-center gap-1.5 lg:gap-2">
                <Switch checked={darkMode} onCheckedChange={toggleTheme} className="scale-75 lg:scale-100" />
                {darkMode ? <Moon className="h-3 w-3 lg:h-4 lg:w-4" /> : <Sun className="h-3 w-3 lg:h-4 lg:w-4" />}
              </div>
            )}

            {/* Language Switcher */}
            <div className="scale-90 lg:scale-100">
              <LanguageSwitcher />
            </div>

            {/* Auth Section */}
            {renderAuthSection()}
          </div>

          {/* Mobile Menu Button */}
          <button
            className="md:hidden text-gray-700 p-2 focus:outline-none"
            onClick={toggleMenu}
            aria-label={isMenuOpen ? t("closeMenu") : t("openMenu")}
          >
            {isMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </header>

      {/* Mobile Navigation */}
      <div
        className={cn(
          "fixed inset-0 z-[60] bg-muted flex flex-col pt-16 px-6 md:hidden transition-all duration-300 ease-in-out",
          isMenuOpen ? "opacity-100 translate-x-0" : "opacity-0 translate-x-full pointer-events-none"
        )}
        style={{ backgroundColor: "hsl(30 23% 93%)" }}
      >
        <button
          className="absolute top-4 right-4 text-gray-700 p-2 focus:outline-none hover:bg-white/50 rounded-lg transition-colors"
          onClick={closeMenu}
          aria-label={t("closeMenu")}
        >
          <X size={28} />
        </button>

        <nav className="flex flex-col space-y-6 items-center mt-8">
          {/* Nav Links */}
          {navItems.map((item) => (
            <a
              key={item.label}
              href={item.href}
              className="text-xl font-medium py-3 px-6 w/full text-center rounded-lg hover:bg-white/50 transition-colors"
              onClick={(e) => {
                item.onClick?.(e);
                closeMenu();
              }}
            >
              {item.label}
            </a>
          ))}

          {/* Dashboard Link */}
          {user && !isDashboardPage && (
            <a
              href="#"
              className="text-xl font-medium py-3 px-6 w-full text-center rounded-lg hover:bg-white/50 transition-colors flex items-center justify-center gap-2"
              onClick={(e) => {
                handleDashboardClick(e);
                closeMenu();
              }}
            >
              📊 {t("Dashboard")}
            </a>
          )}

          {/* Dark Mode Toggle */}
          {!isHomePage && (
            <div className="flex items-center gap-3 py-3 px-6 w-full justify-center rounded-lg hover:bg-white/50 transition-colors">
              <span className="text-sm font-medium">{t("darkMode")}</span>
              <Switch checked={darkMode} onCheckedChange={toggleTheme} />
              {darkMode ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
            </div>
          )}

          {/* Language Switcher */}
          <div className="mt-4 pt-4 border-t border-gray-300/50">
            <LanguageSwitcher />
          </div>

          {/* Auth Section */}
          <div className={cn("w-full", isHomePage ? "mt-6 pt-6 border-t border-gray-300/50" : "mt-6")}>
            {renderAuthSection(true)}
          </div>
        </nav>
      </div>
    </>
  );
};

export default Navbar;
