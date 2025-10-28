"use client";

import { useState, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import useSWR from "swr";
import { createClient } from "@/lib/supabase/client";
import type { User as SupabaseUser } from "@supabase/supabase-js";

interface UserProfile {
  id: number;
  authUserId: string;
  email: string;
  firstName?: string;
  lastName?: string;
  profilePicture?: string;
  hasPassword: boolean;
  createdAt: Date;
}

const supabase = createClient();

// SWR fetcher for profile data
async function fetchProfile(userId: string): Promise<UserProfile | null> {
  try {
    const { data, error } = await supabase
      .from("user")
      .select(
        "id, auth_user_id, email, first_name, last_name, profile_picture, has_password, created_at"
      )
      .eq("auth_user_id", userId)
      .is("deleted_at", null)
      .maybeSingle();

    if (error) {
      console.error("Error fetching profile:", error);
      return null;
    }

    if (!data) return null;

    return {
      id: data.id,
      authUserId: data.auth_user_id,
      email: data.email,
      firstName: data.first_name,
      lastName: data.last_name,
      profilePicture: data.profile_picture,
      hasPassword: data.has_password,
      createdAt: new Date(data.created_at),
    };
  } catch (err) {
    console.error("Profile fetch error:", err);
    return null;
  }
}

export function useAuth() {
  const [user, setUser] = useState<SupabaseUser | null>(null);
  const [loading, setLoading] = useState(true);

  const router = useRouter();
  const pathname = usePathname();

  // Extract language from pathname
  const lang = pathname.split("/")[1] === "el" ? "el" : "en";

  // Use SWR for profile fetching with 10-minute cache
  const {
    data: profile,
    mutate: mutateProfile,
    isLoading: profileLoading,
  } = useSWR(user ? `profile-${user.id}` : null, () => fetchProfile(user!.id), {
    dedupingInterval: 600000, // 10 minutes
    revalidateOnFocus: false,
    revalidateOnReconnect: true,
  });

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
        // Trigger profile refetch on sign in
        mutateProfile();
      } else if (event === "SIGNED_OUT") {
        console.log("🚪 User signed out detected");
        setUser(null);
        // Clear profile cache on sign out
        mutateProfile(null, false);
      }
    });

    handleAuthState();
    return () => subscription.unsubscribe();
  }, [router, mutateProfile]);

  // Dashboard protection - redirect to homepage if not logged in
  useEffect(() => {
    // Wait until loading is complete
    if (loading) return;

    // Check if user is trying to access dashboard without being logged in
    const pathnameWithoutLang = pathname.replace(/^\/(en|el)/, "");
    const isDashboardRoute = pathnameWithoutLang.includes("/dashboard");

    if (isDashboardRoute && !user) {
      console.log("🔒 Unauthorized dashboard access, redirecting to homepage");
      router.replace(`/${lang}`);
    }
  }, [loading, user, pathname, router, lang]);

  // Sign out function
  const signOut = async () => {
    try {
      console.log("🚪 Client-side sign out initiated...");
      await supabase.auth.signOut();
      setUser(null);
      // Clear profile cache
      mutateProfile(null, false);

      // Redirect to homepage after sign out
      const pathnameWithoutLang = pathname.replace(/^\/(en|el)/, "");
      if (pathnameWithoutLang.includes("/dashboard")) {
        window.location.href = `/${lang}`;
      }
    } catch (error) {
      console.error("Sign out error:", error);
      setUser(null);
      mutateProfile(null, false);
      router.replace(`/${lang}`);
    }
  };

  // Sign in function (navigate to login)
  const signIn = () => {
    router.push(`/${lang}/login`);
  };

  return {
    user,
    profile: profile ?? null,
    loading: loading || profileLoading,
    signIn,
    signOut,
  };
}
