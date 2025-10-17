"use client";

import { useState, useEffect } from "react";
import {
  SidebarProvider,
  SidebarTrigger,
  SidebarInset,
} from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { User } from "@supabase/supabase-js";
import { ActiveRoleProvider, useActiveRole } from "@/app/hooks/useActiveRole";

interface Profile {
  id: number;
  email: string;
  first_Name?: string;
  last_Name?: string;
}

function DashboardContent({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const { activeRole } = useActiveRole();
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    const getUser = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.user) {
        setLoading(false);
        return;
      }

      setUser(session.user);

      const { data: profileData } = await supabase
        .from("user")
        .select("id, email, first_Name, last_Name")
        .eq("auth_user_id", session.user.id)
        .is("deleted_at", null)
        .maybeSingle();

      if (profileData) setProfile(profileData);
      setLoading(false);
    };

    getUser();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") {
        setUser(null);
        setProfile(null);
        router.push("/login");
      }
    });

    return () => subscription.unsubscribe();
  }, [supabase.auth, router]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-pulse-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!user) {
    router.push("/login");
    return null;
  }

  return (
    <div className="pt-20">
      <SidebarProvider>
        <div className="min-h-screen flex w-full bg-background">
          <AppSidebar user={user} />
          <SidebarInset className="flex-1">
            <header className="h-14 border-b bg-card flex items-center justify-between px-4 shadow-sm sticky top-16 z-30">
              <div className="flex items-center gap-2">
                <SidebarTrigger className="mr-2" />
                <h1 className="text-lg font-semibold">Dashboard</h1>
                <span className="text-lg text-muted-foreground hidden sm:block">
                  {activeRole.companyName}
                </span>
              </div>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="ghost"
                    className="flex items-center gap-2 p-2"
                  >
                    <span className="text-sm font-medium hidden sm:block">
                      {`Welcome back, ${
                        profile?.first_Name ||
                        user.user_metadata?.first_name ||
                        user.email
                      }`}
                    </span>
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-48" align="end">
                  <Button
                    variant="ghost"
                    onClick={handleSignOut}
                    className="w-full justify-start text-red-600 hover:text-red-700 hover:bg-red-50"
                  >
                    <LogOut className="mr-2 h-4 w-4" />
                    Sign Out
                  </Button>
                </PopoverContent>
              </Popover>
            </header>
            <main className="flex-1 p-6">{children}</main>
          </SidebarInset>
        </div>
      </SidebarProvider>
    </div>
  );
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ActiveRoleProvider>
      <DashboardContent>{children}</DashboardContent>
    </ActiveRoleProvider>
  );
}
