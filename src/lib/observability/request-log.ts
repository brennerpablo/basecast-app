import { SLOW_REQUEST_MS } from "./budgets";
import { log } from "./logger";
import {
  getRequestContext,
  openRequestContext,
  type RequestContext,
  runWithRequestContext,
} from "./request-context";
import { normalizeRoute } from "./route-name";

/**
 * The one `http.request` line per request: 5xx is `error` (ours), 4xx `warn` (the caller's), a slow
 * success `warn`, everything else `info`.
 */
export function logRequest(ctx: RequestContext, status: number, error?: unknown): void {
  const durationMs = Math.round(performance.now() - ctx.startedAt);
  const base = `${ctx.method} ${ctx.route} ${status}`;
  // A 5xx answered without a throw still groups under one fingerprint per route.
  const fingerprint = status >= 500 && !error ? `app:HTTP ${status}:${ctx.route}` : undefined;
  const fields = { status, durationMs, error, fingerprint };
  if (status >= 500) log.error("http.request", base, fields);
  else if (status >= 400) log.warn("http.request", base, fields);
  else if (durationMs > SLOW_REQUEST_MS)
    log.warn("http.request", `${base}, slow: ${durationMs} ms (budget ${SLOW_REQUEST_MS} ms)`, fields);
  else log.info("http.request", base, fields);
}

/** Echoes the id so a browser's network tab leads straight to the log line. */
function withRequestIdHeader(res: Response, requestId: string): Response {
  try {
    res.headers.set("x-request-id", requestId);
    return res;
  } catch {
    const headers = new Headers(res.headers);
    headers.set("x-request-id", requestId);
    return new Response(res.body, { status: res.status, statusText: res.statusText, headers });
  }
}

/**
 * Opens the request's context, runs it and writes its `http.request` line. Re-entrant: inside an open
 * context it only runs, so stacked wrappers never log a request twice. A throw is logged as a 500 and
 * re-thrown, so Next still answers 500 and `onRequestError` still fires.
 */
export async function runWithRequestLog(req: Request, run: () => Promise<Response>): Promise<Response> {
  if (getRequestContext()) return run();
  const ctx = openRequestContext(req, normalizeRoute(req.url));
  return runWithRequestContext(ctx, async () => {
    try {
      const res = await run();
      logRequest(ctx, res.status);
      return withRequestIdHeader(res, ctx.requestId);
    } catch (error) {
      logRequest(ctx, 500, error);
      throw error;
    }
  });
}

/** Wraps a route handler in `runWithRequestLog`. */
export function withRequestLog<Context>(
  handler: (req: Request, context: Context) => Promise<Response> | Response,
): (req: Request, context: Context) => Promise<Response> {
  return (req, context) => runWithRequestLog(req, async () => handler(req, context));
}
