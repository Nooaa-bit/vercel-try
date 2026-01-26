//hype-hire/vercel/lib/server-auth.ts
// hype-hire/vercel/lib/server-auth.ts
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import type { Session } from "@supabase/supabase-js";

// Cache client per request (Next.js creates new module scope per request)
let cachedClient: ReturnType<typeof createServerClient> | null = null;

async function getSupabaseServer() {
  // Return cached client if available
  if (cachedClient) {
    return cachedClient;
  }

  const cookieStore = await cookies();

  cachedClient = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Server Component can't set cookies (read-only in some contexts)
          }
        },
      },
    },
  );

  return cachedClient;
}

export async function getServerSession(): Promise<Session | null> {
  const supabase = await getSupabaseServer();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return session;
}

export async function requireAuth(): Promise<Session> {
  const session = await getServerSession();
  if (!session) {
    throw new Error("Unauthorized");
  }
  return session;
}

export async function getUserId(): Promise<number> {
  const session = await requireAuth();
  const supabase = await getSupabaseServer();

  const { data: profile, error } = await supabase
    .from("user")
    .select("id")
    .eq("auth_user_id", session.user.id)
    .is("deleted_at", null)
    .single();

  if (error || !profile) {
    throw new Error("Profile not found");
  }

  return profile.id;
}

export async function getUserRole(companyId: number) {
  const userId = await getUserId();
  const supabase = await getSupabaseServer();

  const { data: role, error } = await supabase
    .from("user_company_role")
    .select("id, role, company_id, user_id")
    .eq("user_id", userId)
    .eq("company_id", companyId)
    .is("revoked_at", null)
    .single();

  if (error || !role) {
    throw new Error("No access to this company");
  }

  return role;
}

type Role = "talent" | "supervisor" | "company_admin" | "superadmin";

export async function requireRole(companyId: number, minRole: Role) {
  const role = await getUserRole(companyId);

  const weights: Record<Role, number> = {
    talent: 1,
    supervisor: 2,
    company_admin: 3,
    superadmin: 4,
  };

  if (weights[role.role as Role] < weights[minRole]) {
    throw new Error("Insufficient permissions");
  }

  return role;
}

