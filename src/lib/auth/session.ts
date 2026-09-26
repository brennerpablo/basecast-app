import "server-only";

import { getServerSession } from "next-auth";
import { cache } from "react";

import { getAccessMode } from "@/lib/access-mode";
import { authOptions } from "@/lib/auth";

/** The session, read once per request. Always null in ACCESS_MODE=public. */
export const getCachedSession = cache(async () =>
  getAccessMode() === "login" ? getServerSession(authOptions) : null,
);

/**
 * Wraps a BFF route handler: in ACCESS_MODE=login it answers 401 without a session. `proxy.ts`
 * already turns those requests away; this is the check next to the data.
 */
export function withSession<Args extends unknown[]>(
  handler: (request: Request, ...args: Args) => Promise<Response>,
) {
  return async (request: Request, ...args: Args) => {
    if (getAccessMode() === "login" && !(await getCachedSession())) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    return handler(request, ...args);
  };
}
