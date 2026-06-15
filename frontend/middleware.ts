import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

const protectedRoutes = [
  "/dashboard",
  "/resume-analysis",
  "/job-match",
  "/mock-interview",
  "/history",
  "/settings",
  "/analytics",
];
const authRoutes = ["/login", "/signup"];

export async function middleware(request: NextRequest) {
  /**
   * Middleware is the SOLE authority for route-level auth protection.
   *
   * It runs on the server before any page renders, reading the session
   * from HTTP cookies (set by createBrowserClient on the client and
   * propagated via the cookie handlers below).
   *
   * Architecture rules:
   * - AuthProvider owns UI state only. It never redirects.
   * - Login/signup pages redirect ONLY after a successful form submit.
   * - This middleware handles all protective redirects.
   *
   * Session check strategy:
   * - getSession()  → reads cookies, fast, no network call, may contain expired tokens.
   * - getUser()     → validates the token against the Supabase server, authoritative.
   *
   * We use getUser() (server-validated) as the auth signal so an expired
   * or tampered token in cookies never grants access to protected routes.
   */

  // Build a response object we can mutate to forward refreshed cookies.
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          // Write cookies onto both the request (for downstream SSR reads)
          // and the response (to send Set-Cookie headers to the browser).
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // getUser() makes a network call to Supabase to validate the token.
  // This is intentionally used over getSession() for security:
  // getSession() trusts whatever is in the cookie without server validation.
  let user = null;
  try {
    const { data } = await supabase.auth.getUser();
    user = data.user ?? null;
  } catch {
    user = null;
  }

  const isAuthenticated = Boolean(user);
  const { pathname } = request.nextUrl;

  const isProtectedRoute = protectedRoutes.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`)
  );
  const isAuthRoute = authRoutes.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`)
  );

  // Authenticated user trying to reach login/signup → send to dashboard.
  if (isAuthRoute && isAuthenticated) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  // Unauthenticated user trying to reach a protected route → send to login.
  if (isProtectedRoute && !isAuthenticated) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // All other cases: allow the request through, forwarding refreshed cookies.
  return response;
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/resume-analysis/:path*",
    "/job-match/:path*",
    "/mock-interview/:path*",
    "/history/:path*",
    "/settings/:path*",
    "/analytics/:path*",
    "/login",
    "/signup",
  ],
};