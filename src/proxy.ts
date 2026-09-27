import { type NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";

import { gate } from "@/lib/auth/gate";

/**
 * The fast check on the JWT cookie (rules in `gate`): the landing pages for visitors, /sign-in or a 401
 * for the rest. The (app) layout and `withSession` check the session again on the server. The root's
 * redirect lives here, not in next.config: config redirects run before the proxy and would hide the
 * landing page.
 */
export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });

  const action = gate(pathname, search, Boolean(token));
  switch (action.kind) {
    case "next":
      return NextResponse.next();
    case "rewrite":
      return NextResponse.rewrite(new URL(action.to, request.url));
    case "redirect":
      return NextResponse.redirect(new URL(action.to, request.url));
    case "unauthorized":
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export const config = {
  // Everything except next-auth's own routes, Next's assets and files with an extension (icons, logos).
  matcher: ["/((?!api/auth|_next/static|_next/image|.*\\.).*)"],
};
