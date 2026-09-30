import { NextResponse, type NextRequest } from "next/server";

const VISITOR_COOKIE = "mb_visitor";
const APP_PATHS = ["/market", "/analysis", "/profile"];

/**
 * No login: first-time visitors are sent to /welcome to enter their name and district.
 * (The cookie's signature is checked properly on the server; this is only a quick redirect.)
 */
export function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;
  const known = request.cookies.has(VISITOR_COOKIE);

  if (!known && APP_PATHS.some((p) => path === p || path.startsWith(`${p}/`))) {
    const url = request.nextUrl.clone();
    url.pathname = "/welcome";
    url.search = "";
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/market/:path*", "/analysis/:path*", "/profile/:path*"],
};
