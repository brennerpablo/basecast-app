// Rules for what a user edits on /account: shared by the page (to check before sending) and the route
// handlers (the check that counts). No `server-only`: both sides import it.

export const DISPLAY_NAME_MAX = 80;

/** The display name as stored: trimmed, 1 to `DISPLAY_NAME_MAX` characters. */
export function normalizeDisplayName(
  input: unknown,
): { ok: true; name: string } | { ok: false; error: string } {
  if (typeof input !== "string") return { ok: false, error: "Name must be text" };
  const name = input.trim();
  if (!name) return { ok: false, error: "Name can't be empty" };
  if (name.length > DISPLAY_NAME_MAX) {
    return { ok: false, error: `Name can't be longer than ${DISPLAY_NAME_MAX} characters` };
  }
  return { ok: true, name };
}

/** Side of the square the page crops the photo to. */
export const AVATAR_SIZE = 256;

/** Upper bound on an uploaded photo. The page's 256×256 crop is a few dozen KB. */
export const AVATAR_MAX_BYTES = 1024 * 1024;

export type AvatarContentType = "image/png" | "image/jpeg" | "image/webp";

/**
 * The photo's format, read from its first bytes rather than trusted from the upload's
 * `Content-Type`. `null` for anything that is not PNG, JPEG or WebP.
 */
export function sniffImageType(bytes: Uint8Array): AvatarContentType | null {
  const startsWith = (signature: number[], offset = 0) =>
    bytes.length >= offset + signature.length &&
    signature.every((byte, i) => bytes[offset + i] === byte);

  if (startsWith([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "image/png";
  if (startsWith([0xff, 0xd8, 0xff])) return "image/jpeg";
  // "RIFF", four bytes of size, then "WEBP".
  if (startsWith([0x52, 0x49, 0x46, 0x46]) && startsWith([0x57, 0x45, 0x42, 0x50], 8)) {
    return "image/webp";
  }
  return null;
}

/**
 * Where the browser fetches a user's photo. The upload time busts the cache: the path is fixed per
 * user, so without it a new photo would keep showing the old one.
 */
export const avatarUrl = (userId: string, updatedAt: Date) =>
  `/api/users/${encodeURIComponent(userId)}/avatar?v=${updatedAt.getTime()}`;
