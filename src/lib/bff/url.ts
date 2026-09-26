/** Query values a BFF URL takes: empty ones are left out, arrays repeat the name. */
export type Params = Record<string, string | number | boolean | null | undefined | string[]>;

/** The BFF URL of a get-data path: `/api/data/<path>?<params>`. */
export function dataUrl(path: string, params?: Params): string {
  const qs = new URLSearchParams();
  for (const [name, value] of Object.entries(params ?? {})) {
    if (value === null || value === undefined || value === "") continue;
    if (Array.isArray(value)) value.forEach((v) => qs.append(name, v));
    else qs.set(name, String(value));
  }
  const query = qs.toString();
  return `/api/data/${path}${query ? `?${query}` : ""}`;
}
