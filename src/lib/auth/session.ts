import "server-only";

import { getServerSession, type Session } from "next-auth";
import { cache } from "react";

import { authOptions } from "@/lib/auth";
import { enrichRequestContext, runWithRequestLog } from "@/lib/observability";

/** The session, read once per request. */
export const getCachedSession = cache(async () => getServerSession(authOptions));

/**
 * Wraps a BFF route handler: it answers 401 without a session and hands the session to the handler
 * otherwise. `proxy.ts` already turns those requests away; this is the check next to the data. Every
 * request through it also gets its `http.request` line in `ops.log`, with the user on it.
 */
export function withSession<Context = unknown>(
  handler: (request: Request, context: Context, session: Session) => Promise<Response>,
) {
  return async (request: Request, context: Context) =>
    runWithRequestLog(request, async () => {
      const session = await getCachedSession();
      if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });
      enrichRequestContext({ userId: session.user.id });
      return handler(request, context, session);
    });
}
