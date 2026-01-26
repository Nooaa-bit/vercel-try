// middleware.ts 
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

const supported = new Set(["en", "el"]);

export async function middleware(request: NextRequest) {
  // Skip API and auth routes
  const { pathname } = request.nextUrl;
  if (pathname.startsWith("/api") || pathname.startsWith("/auth")) {
    return NextResponse.next();
  }

  // Handle language routing (existing logic)
  if (!pathname.startsWith("/en") && !pathname.startsWith("/el")) {
    const locale = request.cookies.get("language")?.value;
    const finalLocale = supported.has(locale ?? "") ? locale! : "en";
    const url = new URL(`/${finalLocale}${pathname}`, request.url);
    return NextResponse.redirect(url);
  }

  // ✅ Protect dashboard routes
  if (pathname.includes("/dashboard")) {
    const res = NextResponse.next();

    // Create Supabase client for middleware
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value }) => {
              request.cookies.set(name, value);
            });
          },
        },
      },
    );

    const {
      data: { session },
    } = await supabase.auth.getSession();

    // If no session, redirect to login (preserve language)
    if (!session) {
      const lang = pathname.split("/")[1] || "en";
      const loginUrl = new URL(`/${lang}/login`, request.url);
      return NextResponse.redirect(loginUrl);
    }

    return res;
  }

  // Public routes pass through
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next|.*\\..*).*)"],
};
