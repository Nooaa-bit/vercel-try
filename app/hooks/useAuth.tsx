//hype-hire/vercel/app/hooks/useAuth.tsx
"use client";

import { useState, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { User as SupabaseUser } from "@supabase/supabase-js";

export function useAuth() {
  const [user, setUser] = useState<SupabaseUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [signOutCounter, setSignOutCounter] = useState(0);

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
        setSignOutCounter((c) => c + 1);
      }
    });

    handleAuthState();
    return () => subscription.unsubscribe();
  }, [router, pathname, supabase.auth]);

  // Auto-redirect on sign out from protected pages
  useEffect(() => {
    const protectedPaths = ["/dashboard", "/profile", "/dashboard2"];
    const pathnameWithoutLang = pathname.replace(/^\/(en|el)/, "");
    const isOnProtectedPath = protectedPaths.some((path) =>
      pathnameWithoutLang.startsWith(path)
    );

    if (user === null && signOutCounter > 0 && isOnProtectedPath) {
      console.log("🔄 Redirecting after sign out...");
      router.push(`/${lang}?message=You have been signed out`);
      router.refresh();
    }
  }, [user, signOutCounter, pathname, router, lang]);

  // Sign out function
  const signOut = async () => {
    try {
      console.log("🚪 Client-side sign out initiated...");
      await supabase.auth.signOut();
    } catch (error) {
      console.error("Sign out error:", error);
      setUser(null);
      router.push(`/${lang}?message=You have been signed out`);
      router.refresh();
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
