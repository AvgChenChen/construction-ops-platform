import { NextResponse, type NextRequest } from "next/server";

/**
 * First line of defence only: redirects requests that carry no session cookie.
 * It does NOT validate the session (middleware can't reach Postgres cheaply).
 * Real validation happens in requireUser() on every page, server action and API route.
 */
const PUBLIC_PATHS = ["/login", "/signup", "/api/health"];

export function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  if (PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))) return NextResponse.next();
  if (request.cookies.has("session")) return NextResponse.next();

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  const url = request.nextUrl.clone();
  url.pathname = "/login";
  url.search = pathname === "/" ? "" : `?next=${encodeURIComponent(pathname + search)}`;
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg).*)"],
};
