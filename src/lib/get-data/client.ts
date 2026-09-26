import "server-only";

import { getRequestId, log, normalizeRoute, SLOW_REQUEST_MS } from "@/lib/observability";

/**
 * The one place the app calls basecast-get-data. The token stays on the server: the browser only talks to
 * the BFF routes under `/api/data`, which forward here.
 *
 * `GET_DATA_URL` (e.g. http://localhost:8000) and `GET_DATA_TOKEN` (the API's `API_TOKEN`).
 */

export class GetDataUnavailable extends Error {}

function config() {
  const url = process.env.GET_DATA_URL?.trim();
  const token = process.env.GET_DATA_TOKEN?.trim();
  if (!url || !token) throw new GetDataUnavailable("GET_DATA_URL and GET_DATA_TOKEN are not set");
  return { url: url.replace(/\/+$/, ""), token };
}

export type GetDataInit = {
  search?: URLSearchParams | Record<string, string | undefined>;
  headers?: Record<string, string>;
  signal?: AbortSignal;
};

function searchParams(search: GetDataInit["search"]): URLSearchParams {
  if (!search) return new URLSearchParams();
  if (search instanceof URLSearchParams) return search;
  const out = new URLSearchParams();
  for (const [key, value] of Object.entries(search)) if (value !== undefined) out.set(key, value);
  return out;
}

/**
 * One `http.upstream` line per call to get-data (`ops.log`, contract §7). A call that failed or went
 * over the slow budget is stored; the rest only reach stdout, since the BFF's own `http.request` line
 * and get-data's already cover them.
 */
function logUpstream(route: string, startedAt: number, status: number | null, error?: unknown): void {
  const durationMs = Math.round(performance.now() - startedAt);
  const fields = {
    durationMs,
    error,
    context: { upstream: "get-data", upstream_route: route, upstream_status: status },
    ...(status !== null && status >= 500 && !error ? { fingerprint: `app:HTTP ${status} from get-data:${route}` } : {}),
  };
  const base = `get-data GET ${route} ${status ?? "failed"} in ${durationMs} ms`;
  if (status === null || status >= 500) log.error("http.upstream", base, fields);
  else if (durationMs > SLOW_REQUEST_MS || status >= 400) log.warn("http.upstream", base, fields);
  else log.debug("http.upstream", base, fields);
}

/**
 * A GET to get-data, returned as is (status, headers, body stream). It carries the BFF request's id as
 * `x-request-id`, so get-data's log line joins the app's in /ops.
 */
export async function getDataFetch(path: string, init: GetDataInit = {}): Promise<Response> {
  const { url, token } = config();
  const target = new URL(url + path);
  searchParams(init.search).forEach((value, key) => target.searchParams.append(key, value));
  const requestId = getRequestId();
  const route = normalizeRoute(path);
  const startedAt = performance.now();
  try {
    const response = await fetch(target, {
      headers: { Authorization: `Bearer ${token}`, ...(requestId ? { "x-request-id": requestId } : {}), ...init.headers },
      signal: init.signal,
      cache: "no-store",
    });
    logUpstream(route, startedAt, response.status);
    return response;
  } catch (error) {
    // An abort is the browser leaving, not get-data failing.
    if (!init.signal?.aborted) logUpstream(route, startedAt, null, error);
    throw error;
  }
}

/** A GET whose JSON body is returned; non-2xx statuses throw with get-data's `detail`. */
export async function getDataJson<T>(path: string, init: GetDataInit = {}): Promise<T> {
  const response = await getDataFetch(path, init);
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { detail?: unknown } | null;
    throw new Error(typeof body?.detail === "string" ? body.detail : `get-data answered ${response.status}`);
  }
  return (await response.json()) as T;
}
