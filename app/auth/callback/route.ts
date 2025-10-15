//vercel/app/auth/callback/route.ts Handles the OAuth authentication callback
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard";

  const cookieStore = await cookies();
  const language = cookieStore.get("language")?.value || "en";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      // Remove language prefix and normalize path
      const cleanPath = next.replace(/^\/(en|el)/, "").replace(/^(?!\/)/, "/");

      // Build redirect URL
      const redirectPath = `/${language}${cleanPath}`;
      const host = request.headers.get("x-forwarded-host");
      const baseUrl =
        host && process.env.NODE_ENV !== "development"
          ? `https://${host}`
          : origin;

      return NextResponse.redirect(`${baseUrl}${redirectPath}`);
    }
  }

  return NextResponse.redirect(`${origin}/${language}/login?error=auth_failed`);
}
