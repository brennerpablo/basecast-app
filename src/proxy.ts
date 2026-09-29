import { type NextRequest, NextResponse } from "next/server";

import { gate } from "@/lib/gate";

/**
 * The landing pages at `/` and `/how-its-built`, and the retired signed-in screens sent to the home
 * (rules in `gate`). The demo is public: nothing else is checked here.
 */
export function proxy(request: NextRequest) {
  const action = gate(request.nextUrl.pathname);
  switch (action.kind) {
    case "next":
      return NextResponse.next();
    case "rewrite":
      return NextResponse.rewrite(new URL(action.to, request.url));
    case "redirect":
      return NextResponse.redirect(new URL(action.to, request.url));
  }
}

export const config = {
  // Pages only: not the API, Next's assets or files with an extension (icons, logos).
  matcher: ["/((?!api/|_next/static|_next/image|.*\\.).*)"],
};
