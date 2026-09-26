import { OPS_RANGES, type OpsRange } from "./types";

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** How far back each range reaches and the width of its chart buckets. */
export const RANGE_SPEC: Record<OpsRange, { ms: number; bucketMs: number; bucket: string }> = {
  "1h": { ms: HOUR, bucketMs: 5 * MINUTE, bucket: "5 minutes" },
  "24h": { ms: DAY, bucketMs: HOUR, bucket: "1 hour" },
  "7d": { ms: 7 * DAY, bucketMs: 6 * HOUR, bucket: "6 hours" },
  "30d": { ms: 30 * DAY, bucketMs: DAY, bucket: "1 day" },
};

/**
 * Buckets start from midnight in Chicago (CST, UTC−6), so daily buckets are local days. The SQL
 * (`date_bin`) and `bucketStarts` use the same origin.
 */
export const BUCKET_ORIGIN = "2026-01-01T06:00:00Z";

export function parseRange(value: string | null | undefined): OpsRange {
  return (OPS_RANGES as readonly string[]).includes(value ?? "") ? (value as OpsRange) : "24h";
}

/** Every bucket start in `[since, now]`, so a quiet hour still gets its (empty) bar. */
export function bucketStarts(since: Date, now: Date, bucketMs: number): string[] {
  const origin = Date.parse(BUCKET_ORIGIN);
  const first = origin + Math.floor((since.getTime() - origin) / bucketMs) * bucketMs;
  const starts: string[] = [];
  for (let t = first; t <= now.getTime(); t += bucketMs) starts.push(new Date(t).toISOString());
  return starts;
}
