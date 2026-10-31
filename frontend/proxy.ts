import { NextResponse, type NextRequest } from "next/server";

export const SESSION_COOKIE = "garden_session";

// Optimistic check only: a missing cookie means "not signed in", so send people to the login page.
// A present but expired cookie is caught by the API (401) and handled in the page.
export function proxy(request: NextRequest) {
  if (!request.cookies.has(SESSION_COOKIE)) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|login|register|_next/static|_next/image|.*\\..*).*)"],
};
