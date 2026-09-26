import "server-only";

import { getServerSession } from "next-auth";
import { cache } from "react";

import { authOptions } from "@/lib/auth";

/** The session, read once per request. */
export const getCachedSession = cache(async () => getServerSession(authOptions));

/**
 * Wraps a BFF route handler: it answers 401 without a session. `proxy.ts` already turns those
 * requests away; this is the check next to the data.
 */
export function withSession<Args extends unknown[]>(
  handler: (request: Request, ...args: Args) => Promise<Response>,
) {
  return async (request: Request, ...args: Args) => {
    if (!(await getCachedSession())) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    return handler(request, ...args);
  };
}
