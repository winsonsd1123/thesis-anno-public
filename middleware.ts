import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/middleware";
import createIntlMiddleware from "next-intl/middleware";
import { routing } from "@/i18n/routing";

function localeFromPathname(pathname: string): string {
  const first = pathname.split("/").filter(Boolean)[0];
  return routing.locales.includes(first as "en" | "zh") ? first : routing.defaultLocale;
}

const AUTH_ROUTES = ["/login", "/register", "/forgot-password", "/verify-email"];
const PROTECTED_ROUTES_PREFIX = "/dashboard";
const ADMIN_ROUTES_PREFIX = "/admin";
const UPDATE_PASSWORD_ROUTE = "/update-password";

function isAuthRoute(pathname: string): boolean {
  return AUTH_ROUTES.some((r) => pathname === r || pathname.includes(r));
}

function isProtectedRoute(pathname: string): boolean {
  return (
    pathname.includes(PROTECTED_ROUTES_PREFIX) ||
    pathname.includes(ADMIN_ROUTES_PREFIX) ||
    pathname === UPDATE_PASSWORD_ROUTE ||
    pathname.includes(UPDATE_PASSWORD_ROUTE)
  );
}

const intlMiddleware = createIntlMiddleware(routing);

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  const intlResponse = intlMiddleware(request);
  const supabase = createClient(request, intlResponse);

  const { data } = await supabase.auth.getUser();
  const isLoggedIn = !!data?.user;

  if (!isLoggedIn && isProtectedRoute(pathname)) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl, { headers: intlResponse.headers });
  }

  if (isLoggedIn && isProtectedRoute(pathname) && data.user) {
    const { data: profileRow } = await supabase
      .from("profiles")
      .select("is_disabled")
      .eq("id", data.user.id)
      .maybeSingle();

    if (profileRow?.is_disabled === true) {
      const locale = localeFromPathname(pathname);
      const redirectResponse = NextResponse.redirect(
        new URL(`/${locale}/account-disabled`, request.url)
      );
      const supabaseSignOut = createClient(request, redirectResponse);
      await supabaseSignOut.auth.signOut();
      return redirectResponse;
    }
  }

  if (isLoggedIn && isAuthRoute(pathname)) {
    return NextResponse.redirect(new URL("/dashboard", request.url), {
      headers: intlResponse.headers,
    });
  }

  return intlResponse;
}

export const config = {
  matcher: [
    "/((?!api|_next|auth/callback|robots.txt|sitemap.xml|llms.txt|llms-full.txt|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
