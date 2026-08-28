import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySession } from "@/lib/auth/token";

/**
 * Gate for everything under /admin.
 *
 * Renamed from middleware.ts, which Next 16 deprecated. This is an optimistic
 * check only: it keeps signed-out visitors off the pages and keeps the panel
 * out of search results. The authoritative check is requireAdmin() inside each
 * protected page.
 */
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const session = await verifySession(request.cookies.get(SESSION_COOKIE)?.value);

  const deny = () => {
    const url = new URL("/admin/login", request.url);
    if (pathname !== "/admin") url.searchParams.set("from", pathname);
    return NextResponse.redirect(url);
  };

  const response =
    pathname === "/admin/login"
      ? session
        ? NextResponse.redirect(new URL("/admin", request.url))
        : NextResponse.next()
      : session
        ? NextResponse.next()
        : deny();

  // Never let any part of the panel reach an index, even by accident.
  response.headers.set("X-Robots-Tag", "noindex, nofollow, noarchive");
  return response;
}

export const config = {
  matcher: "/admin/:path*",
};
