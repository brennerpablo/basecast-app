// The rows and numbers of /admin/users, kept pure so they are tested without a database.

export type SignInMethod = "Google" | "Password" | "Both";
export type UserRole = "Superadmin" | "User";

/** One user as the admin table shows it. Dates are ISO strings: the row crosses to the client. */
export interface AdminUserRow {
  id: string;
  name: string | null;
  username: string;
  email: string;
  image: string | null;
  method: SignInMethod;
  role: UserRole;
  createdAt: string;
  lastLoginAt: string | null;
}

/** How a user gets in: a password (`npm run user:create`), Google, or both once a password user links Google. */
export function signInMethod(hasPassword: boolean, hasGoogle: boolean): SignInMethod {
  if (hasPassword && hasGoogle) return "Both";
  return hasGoogle ? "Google" : "Password";
}

const WEEK_MS = 7 * 86_400_000;

export interface UserStats {
  total: number;
  /** Users who can sign in with Google (sign-ups and linked password users). */
  google: number;
  /** Created in the last 7 days. */
  newThisWeek: number;
  /** Signed in during the last 7 days. */
  activeThisWeek: number;
}

export function userStats(rows: readonly AdminUserRow[], now = Date.now()): UserStats {
  const since = now - WEEK_MS;
  const within = (iso: string | null) => iso !== null && Date.parse(iso) >= since;
  return {
    total: rows.length,
    google: rows.filter((row) => row.method !== "Password").length,
    newThisWeek: rows.filter((row) => within(row.createdAt)).length,
    activeThisWeek: rows.filter((row) => within(row.lastLoginAt)).length,
  };
}
