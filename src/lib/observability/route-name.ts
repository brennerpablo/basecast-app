/**
 * Turns a resolved request path into a stable route template, as in the Fundsys app: the same route
 * with two ids must land in one bucket for counts and percentiles, and ids have no place in a log
 * kept for 30 days. The query string is dropped.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** Prisma `cuid()`: 25 characters starting with `c`; the range is loose on purpose. */
const CUID = /^c[a-z0-9]{20,30}$/i;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
/** FIPS codes, utility ids and any other bare number long enough to be an id. */
const NUMBER = /^\d{4,}$/;
const HASH = /^[0-9a-f]{32,}$/i;

function normalizeSegment(segment: string): string {
  if (UUID.test(segment)) return ":uuid";
  if (CUID.test(segment)) return ":id";
  if (ISO_DATE.test(segment)) return ":date";
  if (NUMBER.test(segment)) return ":num";
  if (HASH.test(segment)) return ":hash";
  return segment;
}

/**
 * `/api/users/cmxyz…/avatar?v=3` → `/api/users/:id/avatar`. Takes a full URL or a bare path; falsy
 * input yields `/` instead of throwing, because this runs on the logging path.
 */
export function normalizeRoute(pathOrUrl: string | undefined | null): string {
  if (!pathOrUrl) return "/";

  let pathname = pathOrUrl;
  if (pathname.includes("://")) {
    try {
      pathname = new URL(pathname).pathname;
    } catch {
      // Treat the input as a path.
    }
  }
  pathname = pathname.split("?")[0].split("#")[0];
  if (!pathname.startsWith("/")) pathname = `/${pathname}`;
  if (pathname === "/") return "/";

  const normalized = pathname
    .split("/")
    .map((segment, index) => (index === 0 ? segment : normalizeSegment(segment)))
    .join("/");
  return normalized.endsWith("/") ? normalized.slice(0, -1) : normalized;
}
