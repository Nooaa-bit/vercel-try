 //hype-hire/vercel/components/navbar.tsx 
  "use client";

  import Link from "next/link";
  import { useState } from "react";
  import { createClient } from "@/lib/supabase/client";
  import { User } from "@supabase/supabase-js";
  import { useRouter } from "next/navigation";
  import { useLanguage } from "@/lib/LanguageContext";
  import { useTranslation } from "react-i18next";

  export default function Navbar({ user }: { user: User | null }) {
    const [isOpen, setIsOpen] = useState(false);
    const router = useRouter();
    const supabase = createClient();
    const { language, setLanguage } = useLanguage();
    const { t } = useTranslation("common");

    async function handleSignOut() {
      await supabase.auth.signOut();
      router.push(`/${language}/login`);
      router.refresh();
    }

    return (
      <nav className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <Link
                href={`/${language}`}
                className="text-xl font-bold text-blue-600"
              >
                HypeHire
              </Link>
            </div>

            <div className="hidden md:flex md:items-center md:space-x-4">
              {user ? (
                <>
                  <Link
                    href={`/${language}/dashboard/settings`}
                    className="text-gray-700 hover:text-blue-600 px-3 py-2"
                  >
                    {t("navbar.settings")}
                  </Link>
                  <button
                    onClick={handleSignOut}
                    className="text-gray-700 hover:text-blue-600 px-3 py-2"
                  >
                    {t("navbar.signout")}
                  </button>
                </>
              ) : (
                <>
                  <Link
                    href={`/${language}/login`}
                    className="text-gray-700 hover:text-blue-600 px-3 py-2"
                  >
                    {t("navbar.login")}
                  </Link>
                  <Link
                    href={`/${language}/login`}
                    className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-500"
                  >
                    {t("navbar.signup")}
                  </Link>
                </>
              )}

              <div className="flex items-center space-x-2 ml-4 border-l pl-4">
                <button
                  onClick={() => setLanguage("en")}
                  className={`text-sm ${
                    language === "en"
                      ? "text-blue-600 font-semibold"
                      : "text-gray-600 hover:text-blue-600"
                  }`}
                >
                  🇬🇧 EN
                </button>
                <span className="text-gray-400">|</span>
                <button
                  onClick={() => setLanguage("el")}
                  className={`text-sm ${
                    language === "el"
                      ? "text-blue-600 font-semibold"
                      : "text-gray-600 hover:text-blue-600"
                  }`}
                >
                  🇬🇷 ΕΛ
                </button>
              </div>
            </div>

            <div className="md:hidden flex items-center">
              <button
                onClick={() => setIsOpen(!isOpen)}
                className="text-gray-700 hover:text-blue-600"
              >
                <svg
                  className="h-6 w-6"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  {isOpen ? (
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  ) : (
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 6h16M4 12h16M4 18h16"
                    />
                  )}
                </svg>
              </button>
            </div>
          </div>

          {isOpen && (
            <div className="md:hidden pb-4">
              {user ? (
                <>
                  <Link
                    href={`/${language}/dashboard/settings`}
                    className="block text-gray-700 hover:text-blue-600 px-3 py-2"
                    onClick={() => setIsOpen(false)}
                  >
                    {t("navbar.settings")}
                  </Link>
                  <button
                    onClick={() => {
                      handleSignOut();
                      setIsOpen(false);
                    }}
                    className="block w-full text-left text-gray-700 hover:text-blue-600 px-3 py-2"
                  >
                    {t("navbar.signout")}
                  </button>
                </>
              ) : (
                <>
                  <Link
                    href={`/${language}/login`}
                    className="block text-gray-700 hover:text-blue-600 px-3 py-2"
                    onClick={() => setIsOpen(false)}
                  >
                    {t("navbar.login")}
                  </Link>
                  <Link
                    href={`/${language}/login`}
                    className="block text-gray-700 hover:text-blue-600 px-3 py-2"
                    onClick={() => setIsOpen(false)}
                  >
                    {t("navbar.signup")}
                  </Link>
                </>
              )}
              <div className="flex items-center space-x-4 px-3 py-2 border-t mt-2 pt-2">
                <button
                  onClick={() => setLanguage("en")}
                  className={`text-sm ${
                    language === "en"
                      ? "text-blue-600 font-semibold"
                      : "text-gray-600"
                  }`}
                >
                  🇬🇧 EN
                </button>
                <span>|</span>
                <button
                  onClick={() => setLanguage("el")}
                  className={`text-sm ${
                    language === "el"
                      ? "text-blue-600 font-semibold"
                      : "text-gray-600"
                  }`}
                >
                  🇬🇷 ΕΛ
                </button>
              </div>
            </div>
          )}
        </div>
      </nav>
    );
  }
