// middleware.ts ensures URLs always have the language prefix
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const supported = new Set(["en", "el"]);

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/api") || pathname.startsWith("/auth")) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/en") || pathname.startsWith("/el")) {
    return NextResponse.next();
  }

  const locale = request.cookies.get("language")?.value;
  const finalLocale = supported.has(locale ?? "") ? locale! : "en";

  const url = new URL(`/${finalLocale}${pathname}`, request.url);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!_next|.*\\..*).*)"],
};
