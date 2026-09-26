/**
 * `public`: read-only demo without login, for the judges; nothing touches the database.
 * `login`: every page and BFF route needs a session (next-auth, users in Cloud SQL).
 * Anything other than "login" means public, so an unset variable keeps the demo open.
 */
export type AccessMode = "public" | "login";

export const getAccessMode = (): AccessMode =>
  process.env.ACCESS_MODE === "login" ? "login" : "public";
