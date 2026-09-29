import { AsyncLocalStorage } from "node:async_hooks";

/**
 * Per-request correlation, carried implicitly so any log line inside a BFF request can name the
 * request and route without every call site threading them through. Opened by `runWithRequestLog`.
 */
export type RequestContext = {
  /** Correlation id, echoed as `x-request-id`. Vercel's `x-vercel-id` when present. */
  requestId: string;
  method: string;
  /** Route template (`/api/accounts/:id`), never the resolved path. See `route-name.ts`. */
  route: string;
  /** `performance.now()` at request start. */
  startedAt: number;
};

const storage = new AsyncLocalStorage<RequestContext>();

export function runWithRequestContext<T>(ctx: RequestContext, fn: () => T): T {
  return storage.run(ctx, fn);
}

export function getRequestContext(): RequestContext | undefined {
  return storage.getStore();
}

/**
 * `x-vercel-id` seeds the id because it already names the request in Vercel's own logs; locally it is
 * absent and a caller's `x-request-id` or a fresh UUID stands in.
 */
export function openRequestContext(req: Request, route: string): RequestContext {
  return {
    requestId:
      req.headers.get("x-vercel-id") ?? req.headers.get("x-request-id") ?? crypto.randomUUID(),
    method: req.method,
    route,
    startedAt: performance.now(),
  };
}
