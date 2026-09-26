import { AVATAR_MAX_BYTES, avatarUrl, sniffImageType } from "@/lib/account/profile";
import { withSession } from "@/lib/auth/session";
import { getDb } from "@/lib/db";

/**
 * The signed-in user's photo: `PUT` a multipart `file` (the page's 256×256 crop) or `DELETE` it. The
 * page then calls `update()` so the token carries the new URL.
 */
export const PUT = withSession(async (request, _context, session) => {
  const file = (await request.formData().catch(() => null))?.get("file");
  if (!(file instanceof File)) return Response.json({ error: "No file sent" }, { status: 400 });
  if (file.size > AVATAR_MAX_BYTES) {
    return Response.json({ error: "Photo is too large (max. 1 MB)" }, { status: 400 });
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const contentType = sniffImageType(bytes);
  if (!contentType) {
    return Response.json({ error: "Use a PNG, JPEG or WebP image" }, { status: 400 });
  }

  const db = await getDb();
  const userId = session.user.id;
  const { updatedAt } = await db.userAvatar.upsert({
    where: { userId },
    create: { userId, bytes, contentType },
    update: { bytes, contentType },
    select: { updatedAt: true },
  });
  return Response.json({ image: avatarUrl(userId, updatedAt) });
});

export const DELETE = withSession(async (_request, _context, session) => {
  const db = await getDb();
  await db.userAvatar.deleteMany({ where: { userId: session.user.id } });
  return Response.json({ image: null });
});
