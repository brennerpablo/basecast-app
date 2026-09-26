import { withSession } from "@/lib/auth/session";
import { getDb } from "@/lib/db";

/**
 * A user's photo, for anyone signed in (never outside the app). The URL carries the upload time
 * (`?v=`, see `avatarUrl`): a request for the current one is cached for good, anything else is
 * revalidated, so an old link never pins a replaced photo.
 */
export const GET = withSession<{ params: Promise<{ id: string }> }>(
  async (request, context) => {
    const { id } = await context.params;
    const db = await getDb();
    const avatar = await db.userAvatar.findUnique({ where: { userId: id } });
    if (!avatar) return Response.json({ error: "Not found" }, { status: 404 });

    const current = new URL(request.url).searchParams.get("v") === String(avatar.updatedAt.getTime());
    return new Response(avatar.bytes, {
      headers: {
        "Content-Type": avatar.contentType,
        "Cache-Control": current ? "private, max-age=31536000, immutable" : "private, no-cache",
        "X-Content-Type-Options": "nosniff",
      },
    });
  },
);
