import "server-only";

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

/** A GET to get-data, returned as is (status, headers, body stream). */
export async function getDataFetch(path: string, init: GetDataInit = {}): Promise<Response> {
  const { url, token } = config();
  const target = new URL(url + path);
  searchParams(init.search).forEach((value, key) => target.searchParams.append(key, value));
  return fetch(target, {
    headers: { Authorization: `Bearer ${token}`, ...init.headers },
    signal: init.signal,
    cache: "no-store",
  });
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
