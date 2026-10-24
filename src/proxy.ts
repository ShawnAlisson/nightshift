import { NextRequest, NextResponse } from "next/server";
import { COOKIE_NAME, verifySessionToken } from "@/lib/session";

const AUTH_ROUTES = ["/login", "/register"];

// Optimistic check only (cookie signature + expiry). Data access is still verified in the DAL.
export default async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const signedIn = !!(await verifySessionToken(request.cookies.get(COOKIE_NAME)?.value));

  if (pathname.startsWith("/assistant") && !signedIn) {
    return NextResponse.redirect(new URL("/login", request.nextUrl));
  }
  if (AUTH_ROUTES.includes(pathname) && signedIn) {
    return NextResponse.redirect(new URL("/assistant", request.nextUrl));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/assistant/:path*", "/login", "/register"],
};
