import { after } from "next/server";

/** One `ops.log` row, in the Prisma model's field names (`OpsLog`). */
export type OpsLogRow = {
  ts: Date;
  service: string;
  env: string;
  level: string;
  event: string;
  message: string;
  requestId: string | null;
  runId: string | null;
  userId: string | null;
  method: string | null;
  route: string | null;
  status: number | null;
  durationMs: number | null;
  errorClass: string | null;
  errorStack: string | null;
  fingerprint: string | null;
  version: string | null;
  host: string | null;
  context: Record<string, unknown> | null;
};

type Writer = (rows: OpsLogRow[]) => Promise<void>;

/** Imported on first write, so the logger loads without Prisma (tests, scripts, `next build`). */
const prismaWriter: Writer = async (rows) => {
  const { getDb } = await import("@/lib/db");
  const db = await getDb();
  await db.opsLog.createMany({
    data: rows.map(({ context, ...row }) => ({ ...row, ...(context ? { context: context as object } : {}) })),
  });
};

let writer: Writer = prismaWriter;
const pending: OpsLogRow[] = [];
let scheduled = false;

/** Tests swap the database for an array. */
export function setOpsLogWriter(next: Writer | null): void {
  writer = next ?? prismaWriter;
}

/**
 * Rows reach ops.log only from a deploy (Vercel sets `VERCEL` and `VERCEL_ENV`) or when `OPS_LOG=1` asks for it;
 * `OPS_LOG=0` turns them off anywhere. A server on a laptop reaches the production database through the
 * Cloud SQL proxy, and its lines must not land in /ops: locally, stdout is the only copy.
 */
export function opsLogEnabled(env: Record<string, string | undefined> = process.env): boolean {
  if (env.OPS_LOG === "0") return false;
  return env.OPS_LOG === "1" || Boolean(env.VERCEL_ENV || env.VERCEL);
}

/**
 * Queues a row. Inside a request the write runs in `after()`, once the response is sent, so logging
 * never adds to a page's latency; rows from requests that overlap go out in the same insert.
 * Outside a request (`after` throws there) it runs on the next tick.
 */
export function enqueueOpsLog(row: OpsLogRow): void {
  // A writer swapped in (tests) always receives; the database only where `opsLogEnabled` says so.
  if (writer === prismaWriter && !opsLogEnabled()) return;
  pending.push(row);
  if (scheduled) return;
  scheduled = true;
  try {
    after(flushOpsLog);
  } catch {
    setTimeout(() => void flushOpsLog(), 0);
  }
}

/** Writes what is queued. Never throws: a database outage leaves the stdout line as the only copy. */
export async function flushOpsLog(): Promise<void> {
  scheduled = false;
  const rows = pending.splice(0);
  if (rows.length === 0) return;
  try {
    await writer(rows);
  } catch (error) {
    console.error(
      JSON.stringify({
        level: "error",
        event: "ops_log.write_failed",
        message: `Could not write ${rows.length} row(s) to ops.log`,
        error: error instanceof Error ? error.message : String(error),
      }),
    );
  }
}
