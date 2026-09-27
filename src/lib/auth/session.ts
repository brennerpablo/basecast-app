import "server-only";

import { notFound } from "next/navigation";
import { getServerSession, type Session } from "next-auth";
import { cache } from "react";

import { authOptions } from "@/lib/auth";
import { getDb } from "@/lib/db";
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

/**
 * Admin is `isSuperAdmin`, read from the database rather than the token so a revoked admin loses access
 * at once. Everyone else who signs in (Google sign-ups included) gets every other screen.
 */
const isSuperAdmin = cache(async (userId: string) => {
  const db = await getDb();
  const user = await db.user.findUnique({ where: { id: userId }, select: { isSuperAdmin: true } });
  return user?.isSuperAdmin === true;
});

/**
 * For an admin page (or its layout): a non-admin gets a 404, so the screen's existence is not told.
 * Returns the session.
 */
export async function requireSuperAdmin(): Promise<Session> {
  const session = await getCachedSession();
  if (!session || !(await isSuperAdmin(session.user.id))) notFound();
  return session;
}

/** `withSession` for an admin BFF route: 403 for anyone else. */
export function withSuperAdmin<Context = unknown>(
  handler: (request: Request, context: Context, session: Session) => Promise<Response>,
) {
  return withSession<Context>(async (request, context, session) => {
    if (!(await isSuperAdmin(session.user.id))) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }
    return handler(request, context, session);
  });
}
