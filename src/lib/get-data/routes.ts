/**
 * The get-data paths the BFF forwards (`/api/data/<path>` → get-data `/<path>`). Anything else is a 404,
 * so the BFF never turns into an open proxy with the API token attached.
 */
const FORWARDED = [
  /^lake\/sources$/,
  /^lake\/list$/,
  /^lake\/object$/,
  /^lake\/object\/(structure|rows|text|url|content)$/,
  /^tables$/,
  /^tables\/[A-Za-z_][A-Za-z0-9_]{0,62}$/,
  /^tables\/[A-Za-z_][A-Za-z0-9_]{0,62}\/(rows|lineage)$/,
  /^pipeline\/runs$/,
];

export function isForwarded(path: string): boolean {
  return FORWARDED.some((pattern) => pattern.test(path));
}

/** Response headers worth passing back to the browser (bytes, ranges, errors). */
const PASSED_HEADERS = ["content-type", "content-length", "content-range", "accept-ranges", "content-disposition"];

/**
 * Copies get-data's response headers the browser needs onto `headers`. `fetch` has already decoded a
 * gzipped body, so a compressed response's `content-length` (the compressed size) would cut it short.
 */
export function passHeaders(upstream: Headers, headers: Headers): Headers {
  const encoded = (upstream.get("content-encoding") ?? "identity") !== "identity";
  for (const name of PASSED_HEADERS) {
    if (encoded && name === "content-length") continue;
    const value = upstream.get(name);
    if (value) headers.set(name, value);
  }
  return headers;
}
