import "server-only";

import { Prisma } from "@/generated/prisma/client";
import { getDb } from "@/lib/db";

import { pipelineHealth, requestHealth } from "./health";
import { BUCKET_ORIGIN, RANGE_SPEC } from "./range";
import type {
  EtlRunDetail,
  EtlRunRow,
  OpsLevel,
  OpsLogEntry,
  OpsLogPage,
  OpsOverview,
  OpsRange,
  OpsService,
  PipelineDay,
  PipelineHealth,
  RequestServiceHealth,
  RouteStats,
  TopError,
  TrafficPoint,
} from "./types";

/**
 * The reads behind /ops: `ops.log` (every service's log lines) and `public.etl_run` (the pipelines'
 * runs), straight from Postgres rather than through get-data, so the screen still works while the API
 * is down. Aggregates run in SQL; the screen only draws.
 */

const iso = (d: Date | null): string | null => (d ? d.toISOString() : null);
const num = (v: number | bigint | null): number | null => (v === null ? null : Number(v));

function sinceOf(range: OpsRange, now: Date): Date {
  return new Date(now.getTime() - RANGE_SPEC[range].ms);
}

type ServiceStatsRow = {
  service: "app" | "get-data";
  requests: number;
  e5: number;
  p95: number | null;
  n1h: number;
  e5_1h: number;
  p95_1h: number | null;
};

async function requestServices(since: Date, now: Date): Promise<RequestServiceHealth[]> {
  const db = await getDb();
  const hourAgo = new Date(now.getTime() - 3_600_000);
  const from = since < hourAgo ? since : hourAgo;
  const [stats, latest] = await Promise.all([
    db.$queryRaw<ServiceStatsRow[]>`
      SELECT service,
        count(*) FILTER (WHERE ts >= ${since})::int AS requests,
        count(*) FILTER (WHERE ts >= ${since} AND status >= 500)::int AS e5,
        percentile_cont(0.95) WITHIN GROUP (ORDER BY duration_ms) FILTER (WHERE ts >= ${since}) AS p95,
        count(*) FILTER (WHERE ts >= ${hourAgo})::int AS n1h,
        count(*) FILTER (WHERE ts >= ${hourAgo} AND status >= 500)::int AS e5_1h,
        percentile_cont(0.95) WITHIN GROUP (ORDER BY duration_ms) FILTER (WHERE ts >= ${hourAgo}) AS p95_1h
      FROM ops.log
      WHERE event = 'http.request' AND service IN ('app', 'get-data') AND ts >= ${from}
      GROUP BY service`,
    db.$queryRaw<{ service: string; ts: Date; version: string | null; host: string | null }[]>`
      SELECT DISTINCT ON (service) service, ts, version, host
      FROM ops.log WHERE service IN ('app', 'get-data')
      ORDER BY service, ts DESC`,
  ]);
  return (["app", "get-data"] as const).map((service) => {
    const s = stats.find((r) => r.service === service);
    const last = latest.find((r) => r.service === service);
    const health = requestHealth({ requests: s?.n1h ?? 0, errors5xx: s?.e5_1h ?? 0, p95Ms: s?.p95_1h ?? null });
    return {
      service,
      ...health,
      requests: s?.requests ?? 0,
      errors5xx: s?.e5 ?? 0,
      p95Ms: s?.p95 ?? null,
      lastAt: iso(last?.ts ?? null),
      version: last?.version ?? null,
      host: last?.host ?? null,
    };
  });
}

async function pipelines(since: Date, now: Date): Promise<PipelineHealth> {
  const db = await getDb();
  try {
    const [[totals], failing, recent] = await Promise.all([
      db.$queryRaw<{ runs: number; failed: number; rows: number; last_at: Date | null }[]>`
        SELECT count(*) FILTER (WHERE started_at >= ${since})::int AS runs,
          count(*) FILTER (WHERE started_at >= ${since} AND status = 'failed')::int AS failed,
          coalesce(sum(rows) FILTER (WHERE started_at >= ${since}), 0)::float8 AS rows,
          max(started_at) AS last_at
        FROM etl_run`,
      db.$queryRaw<{ source: string; stage: string; status: string; started_at: Date }[]>`
        SELECT source, stage, status, started_at FROM (
          SELECT DISTINCT ON (source, stage) source, stage, status, started_at
          FROM etl_run ORDER BY source, stage, started_at DESC
        ) latest
        WHERE status IN ('failed', 'abandoned')
        ORDER BY started_at DESC`,
      db.$queryRaw<{ source: string; status: string; duration_s: number | null }[]>`
        SELECT source, status, duration_s FROM etl_run ORDER BY started_at DESC LIMIT 24`,
    ]);
    return {
      ...pipelineHealth(failing, totals.last_at, now),
      runs: totals.runs,
      failed: totals.failed,
      rows: totals.rows,
      lastAt: iso(totals.last_at),
      failing: failing.map((f) => ({ source: f.source, stage: f.stage, status: f.status, startedAt: f.started_at.toISOString() })),
      recent: recent.reverse().map((r) => ({ source: r.source, status: r.status, durationS: r.duration_s })),
    };
  } catch (error) {
    // The app reads etl_run through the reader role's grant (prisma/ops-grants.sql); without it the
    // rest of the screen still loads.
    return {
      status: "stalled",
      reason: `Could not read etl_run: ${error instanceof Error ? error.message.split("\n").at(-1) : String(error)}`,
      runs: 0, failed: 0, rows: 0, lastAt: null, failing: [], recent: [],
    };
  }
}

async function traffic(since: Date, bucket: string): Promise<TrafficPoint[]> {
  const db = await getDb();
  const rows = await db.$queryRaw<{ bucket: Date; service: "app" | "get-data"; ok: number; e4: number; e5: number; p95: number | null }[]>`
    SELECT date_bin(${bucket}::interval, ts, ${BUCKET_ORIGIN}::timestamptz) AS bucket, service,
      count(*) FILTER (WHERE status < 400)::int AS ok,
      count(*) FILTER (WHERE status >= 400 AND status < 500)::int AS e4,
      count(*) FILTER (WHERE status >= 500)::int AS e5,
      percentile_cont(0.95) WITHIN GROUP (ORDER BY duration_ms) AS p95
    FROM ops.log
    WHERE event = 'http.request' AND service IN ('app', 'get-data') AND ts >= ${since}
    GROUP BY 1, 2 ORDER BY 1`;
  return rows.map((r) => ({ bucket: r.bucket.toISOString(), service: r.service, ok: r.ok, e4: r.e4, e5: r.e5, p95Ms: r.p95 }));
}

async function topErrors(since: Date): Promise<TopError[]> {
  const db = await getDb();
  const rows = await db.$queryRaw<{ key: string; service: OpsService; error_class: string | null; message: string; place: string | null; count: number; first_at: Date; last_at: Date }[]>`
    SELECT coalesce(fingerprint, service || ':' || event) AS key, service,
      (array_agg(error_class ORDER BY ts DESC))[1] AS error_class,
      (array_agg(message ORDER BY ts DESC))[1] AS message,
      (array_agg(coalesce(route, context->>'source') ORDER BY ts DESC))[1] AS place,
      count(*)::int AS count, min(ts) AS first_at, max(ts) AS last_at
    FROM ops.log
    WHERE level = 'error' AND ts >= ${since}
    GROUP BY 1, 2 ORDER BY count DESC, last_at DESC LIMIT 10`;
  return rows.map((r) => ({
    key: r.key, service: r.service, errorClass: r.error_class, message: r.message, place: r.place,
    count: r.count, firstAt: r.first_at.toISOString(), lastAt: r.last_at.toISOString(),
  }));
}

/**
 * One cell per source per Chicago day over two weeks: `failed` when the day's last run failed,
 * `partial` when something failed but a later run recovered (or finished partial), else that status.
 */
async function pipelineDays(now: Date): Promise<PipelineDay[]> {
  const db = await getDb();
  const since = new Date(now.getTime() - 14 * 86_400_000);
  try {
    const rows = await db.$queryRaw<{ source: string; day: string; last_status: string; had_problem: boolean; runs: number }[]>`
      SELECT source, to_char(started_at AT TIME ZONE 'America/Chicago', 'YYYY-MM-DD') AS day,
        (array_agg(status ORDER BY started_at DESC))[1] AS last_status,
        bool_or(status IN ('failed', 'partial', 'abandoned')) AS had_problem,
        count(*)::int AS runs
      FROM etl_run WHERE started_at >= ${since}
      GROUP BY 1, 2 ORDER BY 1, 2`;
    return rows.map((r) => ({
      source: r.source,
      day: r.day,
      runs: r.runs,
      status: r.last_status === "failed" || r.last_status === "running" ? r.last_status : r.had_problem ? "partial" : r.last_status,
    }));
  } catch {
    return [];
  }
}

export async function getOverview(range: OpsRange, now = new Date()): Promise<OpsOverview> {
  const since = sinceOf(range, now);
  const spec = RANGE_SPEC[range];
  const [services, pipes, points, errors, days] = await Promise.all([
    requestServices(since, now),
    pipelines(since, now),
    traffic(since, spec.bucket),
    topErrors(since),
    pipelineDays(now),
  ]);
  return {
    range, generatedAt: now.toISOString(), since: since.toISOString(), bucketMs: spec.bucketMs,
    services, pipelines: pipes, traffic: points, topErrors: errors, pipelineDays: days,
  };
}

export async function getRouteStats(range: OpsRange, service: "app" | "get-data" | null, now = new Date()): Promise<RouteStats[]> {
  const db = await getDb();
  const since = sinceOf(range, now);
  const rows = await db.$queryRaw<{ service: "app" | "get-data"; method: string | null; route: string | null; requests: number; e4: number; e5: number; p50: number | null; p95: number | null; p99: number | null; max: number | null }[]>`
    SELECT service, method, route, count(*)::int AS requests,
      count(*) FILTER (WHERE status >= 400 AND status < 500)::int AS e4,
      count(*) FILTER (WHERE status >= 500)::int AS e5,
      percentile_cont(0.5) WITHIN GROUP (ORDER BY duration_ms) AS p50,
      percentile_cont(0.95) WITHIN GROUP (ORDER BY duration_ms) AS p95,
      percentile_cont(0.99) WITHIN GROUP (ORDER BY duration_ms) AS p99,
      max(duration_ms) AS max
    FROM ops.log
    WHERE event = 'http.request' AND service IN ('app', 'get-data') AND ts >= ${since}
      ${service ? Prisma.sql`AND service = ${service}` : Prisma.empty}
    GROUP BY 1, 2, 3 ORDER BY p95 DESC NULLS LAST LIMIT 200`;
  return rows.map((r) => ({
    service: r.service, method: r.method ?? "", route: r.route ?? "/", requests: r.requests, e4: r.e4, e5: r.e5,
    p50Ms: r.p50, p95Ms: r.p95, p99Ms: r.p99, maxMs: num(r.max),
  }));
}

type EtlRunDbRow = {
  run_id: string; source: string; stage: string; dag_id: string | null; try_number: number | null;
  started_at: Date; finished_at: Date | null; duration_s: number | null; status: string;
  rows: bigint | null; files: bigint | null; error: string | null; median_s: number | null;
};

function toRun(r: EtlRunDbRow): EtlRunRow {
  return {
    runId: r.run_id, source: r.source, stage: r.stage, dagId: r.dag_id, tryNumber: r.try_number,
    startedAt: r.started_at.toISOString(), finishedAt: iso(r.finished_at), durationS: r.duration_s,
    status: r.status, rows: num(r.rows), files: num(r.files), error: r.error, medianS: r.median_s,
  };
}

export async function getRuns(range: OpsRange, now = new Date()): Promise<EtlRunRow[]> {
  const db = await getDb();
  const since = sinceOf(range, now);
  const monthAgo = new Date(now.getTime() - 30 * 86_400_000);
  const rows = await db.$queryRaw<EtlRunDbRow[]>`
    SELECT r.run_id, r.source, r.stage, r.dag_id, r.try_number, r.started_at, r.finished_at,
      r.duration_s, r.status, r.rows, r.files, r.error, m.median_s
    FROM etl_run r
    LEFT JOIN (
      SELECT source, stage, percentile_cont(0.5) WITHIN GROUP (ORDER BY duration_s) AS median_s
      FROM etl_run WHERE started_at >= ${monthAgo} AND status IN ('success', 'partial')
      GROUP BY 1, 2
    ) m USING (source, stage)
    WHERE r.started_at >= ${since}
    ORDER BY r.started_at DESC LIMIT 300`;
  return rows.map(toRun);
}

export async function getRunDetail(runId: string): Promise<EtlRunDetail | null> {
  const db = await getDb();
  const [rows, logs] = await Promise.all([
    db.$queryRaw<(EtlRunDbRow & { events: unknown; params: unknown })[]>`
      SELECT run_id, source, stage, dag_id, try_number, started_at, finished_at, duration_s, status,
        rows, files, error, NULL::float8 AS median_s, events, params
      FROM etl_run WHERE run_id = ${runId}`,
    getLogs({ range: "30d", runId, limit: 200 }),
  ]);
  const row = rows[0];
  if (!row) return null;
  return { run: { ...toRun(row), events: row.events, params: row.params }, logs: logs.entries };
}

export type LogQuery = {
  range: OpsRange;
  levels?: OpsLevel[];
  services?: OpsService[];
  q?: string;
  requestId?: string;
  runId?: string;
  /** Row id of the last line already shown. */
  before?: string;
  limit?: number;
};

type LogDbRow = {
  id: bigint; ts: Date; service: OpsService; env: string; level: OpsLevel; event: string; message: string;
  request_id: string | null; run_id: string | null; user_id: string | null; method: string | null;
  route: string | null; status: number | null; duration_ms: number | null; error_class: string | null;
  error_stack: string | null; fingerprint: string | null; version: string | null; host: string | null;
  context: Record<string, unknown> | null;
};

export async function getLogs(query: LogQuery, now = new Date()): Promise<OpsLogPage> {
  const db = await getDb();
  const limit = Math.min(Math.max(query.limit ?? 200, 1), 500);
  // A request or a run is shown whole, whatever the range.
  const scoped = Boolean(query.requestId || query.runId);
  const q = query.q?.trim();
  const filters = Prisma.join(
    [
      scoped ? Prisma.sql`TRUE` : Prisma.sql`ts >= ${sinceOf(query.range, now)}`,
      query.services?.length ? Prisma.sql`service = ANY(${query.services})` : Prisma.sql`TRUE`,
      query.requestId ? Prisma.sql`request_id = ${query.requestId}` : Prisma.sql`TRUE`,
      query.runId ? Prisma.sql`run_id = ${query.runId}` : Prisma.sql`TRUE`,
      q
        ? Prisma.sql`(message ILIKE ${`%${q}%`} OR event ILIKE ${`%${q}%`} OR route ILIKE ${`%${q}%`}
            OR fingerprint ILIKE ${`%${q}%`} OR error_class ILIKE ${`%${q}%`}
            OR request_id = ${q} OR run_id = ${q})`
        : Prisma.sql`TRUE`,
    ],
    " AND ",
  );
  const levelFilter = query.levels?.length ? Prisma.sql`AND level = ANY(${query.levels})` : Prisma.empty;
  const beforeFilter = query.before ? Prisma.sql`AND id < ${BigInt(query.before)}` : Prisma.empty;

  const [rows, counts] = await Promise.all([
    db.$queryRaw<LogDbRow[]>`
      SELECT id, ts, service, env, level, event, message, request_id, run_id, user_id, method, route,
        status, duration_ms, error_class, error_stack, fingerprint, version, host, context
      FROM ops.log WHERE ${filters} ${levelFilter} ${beforeFilter}
      ORDER BY ts DESC, id DESC LIMIT ${limit + 1}`,
    db.$queryRaw<{ level: OpsLevel; n: number }[]>`
      SELECT level, count(*)::int AS n FROM ops.log WHERE ${filters} GROUP BY level`,
  ]);
  const page = rows.slice(0, limit);
  const levelCounts: Record<OpsLevel, number> = { info: 0, warn: 0, error: 0 };
  for (const c of counts) if (c.level in levelCounts) levelCounts[c.level] = c.n;
  return {
    entries: page.map((r) => ({
      id: r.id.toString(), ts: r.ts.toISOString(), service: r.service, env: r.env, level: r.level,
      event: r.event, message: r.message, requestId: r.request_id, runId: r.run_id, userId: r.user_id,
      method: r.method, route: r.route, status: r.status, durationMs: r.duration_ms,
      errorClass: r.error_class, errorStack: r.error_stack, fingerprint: r.fingerprint,
      version: r.version, host: r.host, context: r.context,
    })),
    levelCounts,
    nextBefore: rows.length > limit ? page[page.length - 1].id.toString() : null,
  };
}
