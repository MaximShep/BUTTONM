import { NextResponse, type NextRequest } from "next/server";
import { appUrl } from "@/lib/appUrl";
import { SESSION_COOKIE } from "@/lib/session";

const protectedPrefixes = ["/dashboard", "/projects", "/settings"];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const needsAuth = protectedPrefixes.some((prefix) => pathname.startsWith(prefix));

  if (needsAuth && !request.cookies.get(SESSION_COOKIE)?.value) {
    const loginUrl = appUrl("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (pathname === "/login" && request.cookies.get(SESSION_COOKIE)?.value) {
    return NextResponse.redirect(appUrl("/dashboard", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/projects/:path*", "/settings/:path*", "/login"],
};
