import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/features/session-config";

/**
 * Guard every /dashboard/* route with a session cookie check. Redirects
 * unauthenticated requests to the login page.
 *
 * NOTE: middleware cannot call `getSession()` directly because
 * `next/headers` cookies helpers aren't available in the middleware
 * runtime — we check the raw cookie here, and validate it in the
 * underlying page/API via `getSession()`.
 */
export function middleware(req: NextRequest) {
  const session = req.cookies.get(SESSION_COOKIE);
  if (!session?.value) {
    const url = req.nextUrl.clone();
    url.pathname = "/";
    url.searchParams.set("redirected", "1");
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*"],
};
