import { SLOW_REQUEST_MS } from "@/lib/observability/budgets";

import type { HealthStatus } from "./types";

/** Above this share of 5xx in the last hour, a service is degraded. */
export const MAX_5XX_RATE = 0.02;
/** Above this p95 in the last hour, a service is degraded (the BFF's slow-request budget). */
export const MAX_P95_MS = SLOW_REQUEST_MS;
/** Without any pipeline run for this long, the pipelines have stalled. */
export const PIPELINE_STALE_MS = 26 * 60 * 60 * 1000;

export function requestHealth(lastHour: {
  requests: number;
  errors5xx: number;
  p95Ms: number | null;
}): { status: HealthStatus; reason: string } {
  if (lastHour.requests === 0) return { status: "idle", reason: "No requests in the last hour" };
  const rate = lastHour.errors5xx / lastHour.requests;
  if (rate > MAX_5XX_RATE) {
    return { status: "degraded", reason: `${(rate * 100).toFixed(1)}% of requests failed in the last hour` };
  }
  if (lastHour.p95Ms !== null && lastHour.p95Ms > MAX_P95_MS) {
    return { status: "degraded", reason: `p95 of ${Math.round(lastHour.p95Ms).toLocaleString("en-US")} ms in the last hour` };
  }
  return { status: "healthy", reason: "No problems in the last hour" };
}

export function pipelineHealth(
  failing: { source: string }[],
  lastAt: Date | null,
  now: Date,
): { status: HealthStatus; reason: string } {
  if (failing.length > 0) {
    const names = [...new Set(failing.map((f) => f.source))];
    const shown = names.slice(0, 3).join(", ") + (names.length > 3 ? ` and ${names.length - 3} more` : "");
    return { status: "degraded", reason: `Latest run failed: ${shown}` };
  }
  if (!lastAt) return { status: "idle", reason: "No pipeline has run yet" };
  const age = now.getTime() - lastAt.getTime();
  if (age > PIPELINE_STALE_MS) {
    return { status: "stalled", reason: `No run for ${Math.floor(age / 3_600_000)} h` };
  }
  return { status: "healthy", reason: "Every source's latest run succeeded" };
}
