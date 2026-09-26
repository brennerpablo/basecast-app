import { normalizeDisplayName } from "@/lib/account/profile";
import { withSession } from "@/lib/auth/session";
import { getDb } from "@/lib/db";

/** Changes the signed-in user's display name. The page then calls `update()` to refresh the token. */
export const PATCH = withSession(async (request, _context, session) => {
  const body: unknown = await request.json().catch(() => null);
  const result = normalizeDisplayName((body as { name?: unknown } | null)?.name);
  if (!result.ok) return Response.json({ error: result.error }, { status: 400 });

  const db = await getDb();
  await db.user.update({ where: { id: session.user.id }, data: { name: result.name } });
  return Response.json({ name: result.name });
});
