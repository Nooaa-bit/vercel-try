"use client";

import { useState, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { User as SupabaseUser } from "@supabase/supabase-js";

export function useAuth() {
  const [user, setUser] = useState<SupabaseUser | null>(null);
  const [loading, setLoading] = useState(true);

  const router = useRouter();
  const pathname = usePathname();
  const supabase = createClient();

  // Extract language from pathname
  const lang = pathname.split("/")[1] === "el" ? "el" : "en";

  // Main auth state handler
  useEffect(() => {
    const handleAuthState = async () => {
      const hashParams = new URLSearchParams(window.location.hash.substring(1));
      const accessToken = hashParams.get("access_token");
      const refreshToken = hashParams.get("refresh_token");

      if (accessToken && refreshToken) {
        console.log("Processing magic link tokens...");
        try {
          const { data, error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });

          if (error) {
            console.error("Error setting session:", error);
          } else if (data.session) {
            console.log("Session established:", data.session.user.email);
            setUser(data.session.user);
            window.history.replaceState(null, "", window.location.pathname);
            router.refresh();
          }
        } catch (err) {
          console.error("Session processing error:", err);
        }
      } else {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (session?.user) {
          setUser(session.user);
        }
      }

      setLoading(false);
    };

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log("Auth event:", event);

      if (event === "SIGNED_IN" && session) {
        setUser(session.user);
      } else if (event === "SIGNED_OUT") {
        console.log("🚪 User signed out detected");
        setUser(null);

        // Immediate redirect on sign out
        const protectedPaths = ["/dashboard", "/profile", "/dashboard2"];
        const pathnameWithoutLang = pathname.replace(/^\/(en|el)/, "");
        const isOnProtectedPath = protectedPaths.some((path) =>
          pathnameWithoutLang.startsWith(path)
        );

        if (isOnProtectedPath) {
          console.log("🔄 Redirecting to homepage after sign out...");
          router.replace(`/${lang}`);
        }
      }
    });

    handleAuthState();
    return () => subscription.unsubscribe();
  }, [router, pathname, supabase.auth, lang]);

  // Sign out function
  const signOut = async () => {
    try {
      console.log("🚪 Client-side sign out initiated...");
      const protectedPaths = ["/dashboard", "/profile", "/dashboard2"];
      const pathnameWithoutLang = pathname.replace(/^\/(en|el)/, "");
      const isOnProtectedPath = protectedPaths.some((path) =>
        pathnameWithoutLang.startsWith(path)
      );

      await supabase.auth.signOut();

      // Immediate redirect after sign out
      if (isOnProtectedPath) {
        router.replace(`/${lang}`);
      }
    } catch (error) {
      console.error("Sign out error:", error);
      setUser(null);
      router.replace(`/${lang}`);
    }
  };

  // Sign in function (navigate to login)
  const signIn = () => {
    router.push(`/${lang}/login`);
  };

  return {
    user,
    loading,
    signIn,
    signOut,
  };
}
