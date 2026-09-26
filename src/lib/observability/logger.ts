import { getRequestContext } from "./request-context";
import { enqueueOpsLog, type OpsLogRow } from "./sink";

/**
 * The app's side of the standardized log (`ops.log`, contract in basecast-get-data
 * `docs/data-contract.md`). Every call prints one JSON line on stdout (Vercel's runtime log) and,
 * from `info` up, queues the same row for the `ops.log` table that /ops reads.
 *
 * Ported from the Fundsys app's `src/lib/observability/logger.ts`: no pino (its worker thread breaks
 * under Turbopack and Vercel only wants stdout), and `warn` goes to `console.log` because Vercel
 * files `console.warn` as an error on non-streaming functions.
 */

export type Level = "debug" | "info" | "warn" | "error";

const WEIGHT: Record<Level, number> = { debug: 10, info: 20, warn: 30, error: 40 };

export type LogFields = {
  requestId?: string;
  runId?: string;
  userId?: string;
  method?: string;
  route?: string;
  status?: number;
  durationMs?: number;
  /** An exception: fills `error_class`, `error_stack` and, unless given, `fingerprint`. */
  error?: unknown;
  fingerprint?: string;
  /** Everything else. Scrubbed of secrets before it is printed or stored. */
  context?: Record<string, unknown>;
};

const MAX_STACK_LINES = 15;
const MAX_DEPTH = 4;
const MAX_ARRAY_ITEMS = 50;
const MAX_MESSAGE_CHARS = 2_000;

/**
 * Safety net on key names, not the primary control (which is not passing the value in): a future
 * `log.info(..., { context: { user } })` must not leak a password hash or a session token.
 */
const REDACTED_KEYS = new Set([
  "password", "passwordhash", "token", "secret", "apikey", "api_key", "authorization", "cookie",
  "set-cookie", "accesstoken", "refreshtoken", "clientsecret", "credentials", "privatekey",
  "sessiontoken", "email",
]);

export function scrub(value: unknown, depth = 0): unknown {
  if (value === null || value === undefined) return value;
  if (depth > MAX_DEPTH) return "[depth]";
  if (value instanceof Error) return { name: value.name, message: value.message };
  if (typeof value === "bigint") return value.toString();
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "function") return "[function]";
  if (Array.isArray(value)) {
    const items = value.slice(0, MAX_ARRAY_ITEMS).map((v) => scrub(v, depth + 1));
    if (value.length > MAX_ARRAY_ITEMS) items.push(`[+${value.length - MAX_ARRAY_ITEMS} more]`);
    return items;
  }
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      out[key] = REDACTED_KEYS.has(key.toLowerCase()) ? "[redacted]" : scrub(val, depth + 1);
    }
    return out;
  }
  return value;
}

function stdoutMinWeight(): number {
  const configured = process.env.LOG_LEVEL as Level | undefined;
  if (configured && configured in WEIGHT) return WEIGHT[configured];
  return process.env.NODE_ENV === "production" ? WEIGHT.info : WEIGHT.debug;
}

function environment(): string {
  return process.env.VERCEL_ENV ?? (process.env.NODE_ENV === "production" ? "production" : "development");
}

function errorParts(error: unknown): { errorClass?: string; errorStack?: string; detail?: string } {
  if (error === undefined || error === null) return {};
  if (error instanceof Error) {
    return {
      errorClass: error.name || "Error",
      errorStack: error.stack?.split("\n").slice(0, MAX_STACK_LINES).join("\n"),
      detail: error.message,
    };
  }
  return { errorClass: "NonError", detail: String(error) };
}

/** The row for one log call: the fields given, filled in from the open request. */
export function buildRow(level: Level, event: string, message: string, fields: LogFields = {}): OpsLogRow {
  const ctx = getRequestContext();
  const { errorClass, errorStack, detail } = errorParts(fields.error);
  const route = fields.route ?? ctx?.route;
  const context = scrub({
    ...fields.context,
    ...(detail && !message.includes(detail) ? { error_message: detail } : {}),
  }) as Record<string, unknown>;
  return {
    ts: new Date(),
    service: "app",
    env: environment(),
    level,
    event,
    message: message.slice(0, MAX_MESSAGE_CHARS),
    requestId: fields.requestId ?? ctx?.requestId ?? null,
    runId: fields.runId ?? null,
    userId: fields.userId ?? ctx?.userId ?? null,
    method: fields.method ?? ctx?.method ?? null,
    route: route ?? null,
    status: fields.status ?? null,
    durationMs: fields.durationMs ?? null,
    errorClass: errorClass ?? null,
    errorStack: errorStack ?? null,
    fingerprint:
      fields.fingerprint ?? (errorClass ? `app:${errorClass}:${route ?? event}` : null),
    version: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? null,
    host: process.env.VERCEL_REGION ?? null,
    context: Object.keys(context).length ? context : null,
  };
}

function print(row: OpsLogRow): void {
  let line: string;
  try {
    line = JSON.stringify(row);
  } catch {
    line = JSON.stringify({ level: row.level, event: row.event, message: row.message, serializationError: true });
  }
  if (row.level === "error") console.error(line);
  else console.log(line);
}

function emit(level: Level, event: string, message: string, fields?: LogFields): void {
  try {
    const row = buildRow(level, event, message, fields);
    if (WEIGHT[level] >= stdoutMinWeight()) print(row);
    if (WEIGHT[level] >= WEIGHT.info) enqueueOpsLog(row);
  } catch {
    // Logging never turns into the request's failure.
  }
}

export const log = {
  /** stdout only; never stored. */
  debug: (event: string, message: string, fields?: LogFields) => emit("debug", event, message, fields),
  info: (event: string, message: string, fields?: LogFields) => emit("info", event, message, fields),
  warn: (event: string, message: string, fields?: LogFields) => emit("warn", event, message, fields),
  error: (event: string, message: string, fields?: LogFields) => emit("error", event, message, fields),
};
