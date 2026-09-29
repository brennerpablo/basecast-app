import type { Instrumentation } from "next";

/**
 * Fires on every unhandled server error: Server Components, Route Handlers, Server Actions and the
 * proxy. BFF routes already log their own `http.request` line; this catches what never reached one
 * (a page render, a layout) as a `server.error` line.
 */
export const onRequestError: Instrumentation.onRequestError = async (error, request, context) => {
  // The logger keeps request state in AsyncLocalStorage: Node only.
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { log, normalizeRoute } = await import("./lib/observability");
  const route = context.routePath ?? normalizeRoute(request.path);
  log.error("server.error", `Unhandled ${context.routeType} error on ${route}`, {
    method: request.method,
    route,
    error,
    context: {
      digest: (error as { digest?: string } | null)?.digest,
      routerKind: context.routerKind,
      routeType: context.routeType,
      renderSource: context.renderSource,
      revalidateReason: context.revalidateReason,
    },
    requestId: typeof request.headers["x-vercel-id"] === "string" ? request.headers["x-vercel-id"] : undefined,
  });
};
