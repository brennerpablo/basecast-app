import { type NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";

import { getAccessMode } from "@/lib/access-mode";

const HOME = "/explorer";
const SIGN_IN = "/sign-in";

/**
 * ACCESS_MODE=login: without a session, pages redirect to /sign-in (keeping where the visitor was
 * going) and API routes answer 401. This is the fast check on the JWT cookie; the (app) layout and
 * `withSession` check the session again on the server.
 * ACCESS_MODE=public: everything is open and /sign-in has nothing to do.
 */
export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const onSignIn = pathname === SIGN_IN;

  if (getAccessMode() === "public") {
    return onSignIn ? NextResponse.redirect(new URL(HOME, request.url)) : NextResponse.next();
  }

  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
  if (onSignIn) {
    return token ? NextResponse.redirect(new URL(HOME, request.url)) : NextResponse.next();
  }
  if (token) return NextResponse.next();

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const signIn = new URL(SIGN_IN, request.url);
  signIn.searchParams.set("callbackUrl", pathname + search);
  return NextResponse.redirect(signIn);
}

export const config = {
  // Everything except next-auth's own routes, Next's assets and files with an extension (icons, logos).
  matcher: ["/((?!api/auth|_next/static|_next/image|.*\\.).*)"],
};
