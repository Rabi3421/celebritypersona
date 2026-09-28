import { NextResponse, type NextRequest } from "next/server";
import { renewedCookie, SESSION_COOKIE, shouldRenew, verifySession } from "@/lib/auth/token";

/**
 * Gate for everything under /admin and /api/admin.
 *
 * Renamed from middleware.ts, which Next 16 deprecated. This is an optimistic
 * check only: it keeps signed-out visitors off the pages and keeps the panel
 * out of search results. The authoritative check is readSession() inside each
 * protected page, action and route, which also sees "Sign out everywhere".
 *
 * It is also where the session slides: any admin request — a page load, a
 * save, an upload — carrying a live token old enough to renew gets a fresh
 * cookie on its response.
 */
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const session = await verifySession(request.cookies.get(SESSION_COOKIE)?.value);
  const isApi = pathname.startsWith("/api/admin");
  // A save posts to the page it is on. Redirecting it would navigate the tab
  // to the login page and throw the form away, so it is let through: the
  // action itself finds the session gone and says so, and the form keeps
  // everything that was typed.
  const isServerAction = request.method === "POST" && request.headers.has("next-action");

  const deny = () => {
    if (isApi) {
      return NextResponse.json({ error: "Not signed in.", code: "signed-out" }, { status: 401 });
    }
    if (isServerAction) return NextResponse.next();
    const url = new URL("/admin/login", request.url);
    if (pathname !== "/admin") url.searchParams.set("from", pathname);
    return NextResponse.redirect(url);
  };

  // The login page decides for itself whether you are already signed in: only
  // it can see a session revoked by "Sign out everywhere", and bouncing such a
  // token from here to /admin and back would loop.
  const response = pathname === "/admin/login" || session ? NextResponse.next() : deny();

  if (session && shouldRenew(session)) response.cookies.set(await renewedCookie(session));

  // Never let any part of the panel reach an index, even by accident.
  response.headers.set("X-Robots-Tag", "noindex, nofollow, noarchive");
  return response;
}

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*"],
};
