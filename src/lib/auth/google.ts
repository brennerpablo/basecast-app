// Rules for "Continue with Google", kept pure so they are tested without a database; the database side is
// `src/lib/auth/google-user.ts`. Anyone with a Google account can sign up: they get every screen but the
// admin ones (`isSuperAdmin`).

const USERNAME_MIN = 3;
const USERNAME_MAX = 32;

/**
 * The username a new Google user starts with: their email's local part, reduced to what
 * `USERNAME_PATTERN` accepts ("Jane.Doe+work@x.com" → "jane.doework"), padded to 3 characters.
 */
export function usernameFromEmail(email: string): string {
  const local = email.split("@")[0].toLowerCase();
  const base = local
    .replace(/[^a-z0-9._-]/g, "")
    .replace(/^[._-]+/, "")
    .slice(0, USERNAME_MAX);
  if (base.length >= USERNAME_MIN) return base;
  return (base || "user").padEnd(USERNAME_MIN, "0");
}

/**
 * The first of `base`, `base-2`, `base-3`… that nobody has. The suffix replaces the end of a long base,
 * so the result stays within 32 characters. `taken` holds the usernames that start with `base`'s first
 * characters (the caller's query), so the loop always ends.
 */
export function pickUsername(base: string, taken: ReadonlySet<string>): string {
  if (!taken.has(base)) return base;
  for (let n = 2; ; n++) {
    const suffix = `-${n}`;
    const candidate = base.slice(0, USERNAME_MAX - suffix.length) + suffix;
    if (!taken.has(candidate)) return candidate;
  }
}

/** The claims of Google's ID token that sign-in reads. */
export interface GoogleProfile {
  sub: string;
  email?: string;
  email_verified?: boolean;
  name?: string;
  picture?: string;
}

type KnownUser = { id: string; googleId: string | null };

export type GoogleSignIn =
  | { kind: "reject"; reason: "email_not_verified" | "email_taken_by_other_google_account" }
  | { kind: "existing"; userId: string }
  /** A user created with a password (e.g. `admin`) signs in with Google for the first time. */
  | { kind: "link"; userId: string }
  | { kind: "create" };

/**
 * What a Google sign-in does, given the user already holding its Google id (`byGoogleId`) and the one
 * holding its email (`byEmail`). Only an email Google has verified links or creates an account: an
 * unverified one could be anybody's. An email already tied to another Google account is refused rather
 * than moved.
 */
export function planGoogleSignIn(
  profile: Pick<GoogleProfile, "email" | "email_verified">,
  byGoogleId: KnownUser | null,
  byEmail: KnownUser | null,
): GoogleSignIn {
  if (byGoogleId) return { kind: "existing", userId: byGoogleId.id };
  if (!profile.email || profile.email_verified !== true) {
    return { kind: "reject", reason: "email_not_verified" };
  }
  if (!byEmail) return { kind: "create" };
  if (byEmail.googleId) return { kind: "reject", reason: "email_taken_by_other_google_account" };
  return { kind: "link", userId: byEmail.id };
}
