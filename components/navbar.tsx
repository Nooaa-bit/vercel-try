//hype-hire/web/components/Navbar.tsx
"use client";

import React from "react";
import { cn } from "@/lib/utils";
import { Menu, X, LogOut, User, Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useRouter, usePathname } from "next/navigation";
import { useLanguage } from "@/lib/LanguageContext";
import LanguageSwitcher from "@/components/LanguageSwitcher";

// Import custom hooks
import { useAuth } from "@/app/hooks/useAuth";
import { useTheme } from "@/app/hooks/useTheme";
import { useScrollPosition } from "@/app/hooks/useScrollPosition";
import { useMobileMenu } from "@/app/hooks/useMobileMenu";

const Navbar = () => {
  // Custom hooks
  const { user, loading: authLoading, signIn, signOut } = useAuth();
  const { theme, toggle: toggleTheme } = useTheme();
  const isScrolled = useScrollPosition(10);
  const {
    isOpen: isMenuOpen,
    toggle: toggleMenu,
    close: closeMenu,
    scrollToTop,
  } = useMobileMenu();
  const { t, loading: translationsLoading } = useLanguage();
  
  // Derived state
  const darkMode = theme === "dark";

  // Next.js hooks
  const router = useRouter();
  const pathname = usePathname();

  // Page checks
  const isHomePage = pathname === "/";
  const isDashboardPage = pathname.startsWith("/dashboard");

  // Navigation helpers
  const goHome = () => {
    router.push("/");
  };

  const handleLogoClick = (e: React.MouseEvent) => {
    e.preventDefault();
    if (isHomePage) {
      scrollToTop();
    } else {
      goHome();
    }
  };

  const handleNavClick = (action: () => void) => {
    action();
    closeMenu();
  };

  // Show loading state if translations are loading
  if (translationsLoading) {
    return (
      <header className="fixed top-0 left-0 right-0 z-50 py-2 sm:py-3 md:py-4 bg-white/80 backdrop-blur-md">
        <div className="container flex items-center justify-between px-4 sm:px-6 lg:px-8">
          <img src="/logo.png" alt="Hype Hire Logo" className="h-10 sm:h-12" />
          <div className="flex items-center space-x-2">
            <div className="w-4 h-4 border-2 border-pulse-500 border-t-transparent rounded-full animate-spin"></div>
          </div>
        </div>
      </header>
    );
  }

  return (
    <header
      className={cn(
        "fixed top-0 left-0 right-0 z-50 py-2 sm:py-3 md:py-4 transition-all duration-300",
        isScrolled ? "bg-white/20 backdrop-blur-lg shadow-sm" : "bg-transparent"
      )}
    >
      <div className="container flex items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Logo */}
        <a
          href="#"
          className="flex items-center space-x-2 cursor-pointer"
          onClick={handleLogoClick}
          aria-label="Hype Hire"
        >
          <img src="/logo.png" alt="Hype Hire Logo" className="h-10 sm:h-12" />
        </a>

        {/* Desktop Navigation */}
        <div className="hidden md:flex items-center space-x-8">
          {/* Navigation links - only on homepage */}
          {isHomePage && (
            <nav className="flex items-center space-x-8">
              <a
                href="#"
                className="nav-link"
                onClick={(e) => {
                  e.preventDefault();
                  scrollToTop();
                }}
              >
                {t("nav.home")}
              </a>
              <a href="#features" className="nav-link">
                {t("nav.about")}
              </a>
              <a href="#details" className="nav-link">
                {t("nav.contact")}
              </a>
            </nav>
          )}

          {/* Dashboard button - only if logged in AND not on dashboard */}
          {user && !isDashboardPage && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push("/dashboard")}
              className="flex items-center gap-2 text-gray-600 dark:text-gray-300 hover:text-pulse-600 dark:hover:text-pulse-400"
            >
              📊 Dashboard
            </Button>
          )}

          {/* Dark Mode Toggle - only on non-homepage */}
          {!isHomePage && (
            <div className="flex items-center gap-2">
              <Switch checked={darkMode} onCheckedChange={toggleTheme} />
              {darkMode ? (
                <Moon className="h-4 w-4" />
              ) : (
                <Sun className="h-4 w-4" />
              )}
            </div>
          )}

          {/* Language Switcher */}
          <LanguageSwitcher />

          {/* Auth section */}
          {authLoading ? (
            <div className="flex items-center space-x-2">
              <div className="w-4 h-4 border-2 border-pulse-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : user ? (
            <div className="flex items-center space-x-3">
              <div className="relative">
                <div className="w-8 h-8 bg-gradient-to-br from-pulse-500 to-pulse-600 rounded-full flex items-center justify-center text-white font-semibold text-xs shadow-md">
                  {user.user_metadata?.first_name?.[0]?.toUpperCase() ||
                    user.email?.[0]?.toUpperCase()}
                </div>
                <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-green-500 rounded-full border-2 border-white shadow-sm"></div>
              </div>

              <div className="hidden lg:block">
                <div className="text-sm font-medium text-gray-900">
                  {user.user_metadata?.first_name}{" "}
                  {user.user_metadata?.last_name}
                </div>
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={signOut}
                className="bg-transparent border-gray-300 text-gray-600 hover:bg-red-50 hover:border-red-300 hover:text-red-600"
              >
                <LogOut className="w-4 h-4 mr-2" />
                {t("nav.signOut")}
              </Button>
            </div>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={signIn}
              className="bg-transparent border-pulse-500 text-pulse-500 hover:bg-pulse-500 hover:text-white transition-all duration-300"
            >
              <User className="w-4 h-4 mr-2" />
              {t("nav.login")}
            </Button>
          )}
        </div>

        {/* Mobile menu button */}
        <button
          className="md:hidden text-gray-700 p-3 focus:outline-none"
          onClick={toggleMenu}
          aria-label={
            isMenuOpen
              ? t("nav.closeMenu") || "Close menu"
              : t("nav.openMenu") || "Open menu"
          }
        >
          {isMenuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {/* Mobile Navigation */}
      <div
        className={cn(
          "fixed inset-0 z-40 bg-white flex flex-col pt-16 px-6 md:hidden transition-all duration-300 ease-in-out",
          isMenuOpen
            ? "opacity-100 translate-x-0"
            : "opacity-0 translate-x-full pointer-events-none"
        )}
      >
        <nav className="flex flex-col space-y-6 items-center mt-8">
          {/* Navigation links - only on homepage */}
          {isHomePage && (
            <>
              <a
                href="#"
                className="text-xl font-medium py-3 px-6 w-full text-center rounded-lg hover:bg-gray-100"
                onClick={(e) => {
                  e.preventDefault();
                  handleNavClick(scrollToTop);
                }}
              >
                {t("nav.home")}
              </a>
              <a
                href="#features"
                className="text-xl font-medium py-3 px-6 w-full text-center rounded-lg hover:bg-gray-100"
                onClick={() => closeMenu()}
              >
                {t("nav.about")}
              </a>
              <a
                href="#details"
                className="text-xl font-medium py-3 px-6 w-full text-center rounded-lg hover:bg-gray-100"
                onClick={() => closeMenu()}
              >
                {t("nav.contact")}
              </a>
            </>
          )}

          {/* Mobile Dark Mode Toggle - only on non-homepage */}
          {!isHomePage && (
            <div className="flex items-center gap-3 py-3 px-6 w-full justify-center rounded-lg hover:bg-gray-100">
              <span className="text-sm font-medium">Dark Mode</span>
              <Switch checked={darkMode} onCheckedChange={toggleTheme} />
              {darkMode ? (
                <Moon className="h-4 w-4" />
              ) : (
                <Sun className="h-4 w-4" />
              )}
            </div>
          )}

          {/* Mobile Language Switcher */}
          <div className="mt-4 pt-4 border-t border-gray-200">
            <LanguageSwitcher />
          </div>

          {/* Mobile Auth Section */}
          <div
            className={cn(
              "w-full",
              isHomePage ? "mt-6 pt-6 border-t border-gray-200" : "mt-6"
            )}
          >
            {authLoading ? (
              <div className="flex items-center justify-center space-x-2">
                <div className="w-4 h-4 border-2 border-pulse-500 border-t-transparent rounded-full animate-spin"></div>
                <span className="text-sm text-gray-600">
                  {t("common.loading")}
                </span>
              </div>
            ) : user ? (
              <div className="space-y-4">
                <div className="flex items-center space-x-3 justify-center">
                  <div className="relative">
                    <div className="w-10 h-10 bg-gradient-to-br from-pulse-500 to-pulse-600 rounded-full flex items-center justify-center text-white font-semibold text-sm shadow-md">
                      {user.user_metadata?.first_name?.[0]?.toUpperCase() ||
                        user.email?.[0]?.toUpperCase()}
                    </div>
                    <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 rounded-full border-2 border-white shadow-sm"></div>
                  </div>
                  <div>
                    <div className="text-sm font-medium text-gray-900">
                      {user.user_metadata?.first_name}{" "}
                      {user.user_metadata?.last_name}
                    </div>
                    <div className="text-xs text-gray-500">{user.email}</div>
                  </div>
                </div>

                <Button
                  variant="outline"
                  className="w-full border-red-300 text-red-600 hover:bg-red-50"
                  onClick={() => handleNavClick(signOut)}
                >
                  <LogOut className="w-4 h-4 mr-2" />
                  {t("nav.signOut")}
                </Button>
              </div>
            ) : (
              <Button
                className="w-full bg-pulse-500 hover:bg-pulse-600 text-white"
                onClick={() => handleNavClick(signIn)}
              >
                <User className="w-4 h-4 mr-2" />
                {t("nav.login")}
              </Button>
            )}
          </div>
        </nav>
      </div>
    </header>
  );
};

export default Navbar;
