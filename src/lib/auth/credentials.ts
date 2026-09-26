// Rules shared by the sign-in check (`src/lib/auth.ts`) and `scripts/create-user.ts`. No
// `server-only` here: the script runs outside Next.

/** bcrypt cost for new password hashes. */
export const BCRYPT_COST = 12;

export const MIN_PASSWORD_LENGTH = 12;

/**
 * Lowercase letters, digits, dots, dashes and underscores, 3 to 32 characters. No "@", so a sign-in
 * identifier with "@" is always an email and one without is always a username.
 */
export const USERNAME_PATTERN = /^[a-z0-9][a-z0-9._-]{2,31}$/;

/** Emails and usernames are stored and looked up trimmed and lowercase. */
export const normalizeIdentifier = (value: string | null | undefined) =>
  (value ?? "").trim().toLowerCase();

/**
 * A bcrypt hash (cost 12) of a random string nobody kept. Sign-in compares against it when the user
 * does not exist, so an unknown username takes as long to reject as a wrong password.
 */
export const DUMMY_PASSWORD_HASH =
  "$2b$12$8iGMDPVfWBZ836P3ipd07.1imcJnF1bryiab2HuRJvmavmzewh8WW";
