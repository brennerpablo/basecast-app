/**
 * Lake keys and app routes. The route mirrors the bucket path, so every folder and file has its own link:
 * `raw/source=ercot_gis/dt=2026-08-01/<file>` ↔ `/data/lake/raw/source=ercot_gis/dt=2026-08-01/<file>`.
 */

export const LAKE_BUCKET = "gs://basecast-509812-lake";
const BASE = "/data/lake";

/** Encodes one path segment, keeping `=` readable (`source=ercot_gis`, not `source%3Dercot_gis`). */
export function encodeSegment(segment: string): string {
  return encodeURIComponent(segment).replace(/%3D/gi, "=");
}

function decodeSegment(segment: string): string {
  if (!segment.includes("%")) return segment;
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}

/** The app route of a key or folder prefix (`raw/source=x/`), with optional query params. */
export function lakeHref(key: string, query?: Record<string, string | number | null | undefined>): string {
  const path = key.replace(/\/+$/, "").split("/").filter(Boolean).map(encodeSegment).join("/");
  const href = path ? `${BASE}/${path}` : BASE;
  const params = new URLSearchParams();
  for (const [name, value] of Object.entries(query ?? {})) {
    if (value !== null && value !== undefined && value !== "") params.set(name, String(value));
  }
  const qs = params.toString();
  return qs ? `${href}?${qs}` : href;
}

/** The key from the catch-all route's segments. */
export function keyFromSegments(segments: string[] | undefined): string {
  return (segments ?? []).map(decodeSegment).join("/");
}

/** Files have an extension; folders are layers, `source=`, `dt=` or plain names. */
export function isFileKey(key: string): boolean {
  const last = key.split("/").at(-1) ?? "";
  return last.includes(".") && !/^(source|dt)=/.test(last);
}

/** A folder key as get-data's `prefix`: ends with `/`, empty for the bucket root. */
export function folderPrefix(key: string): string {
  const trimmed = key.replace(/\/+$/, "");
  return trimmed ? `${trimmed}/` : "";
}

export type LakeCrumb = { label: string; key: string };

/** The bucket path as crumbs: bucket, layer, `source=…`, `dt=…`, file. */
export function lakeCrumbs(key: string): LakeCrumb[] {
  const parts = key.split("/").filter(Boolean);
  return [
    { label: LAKE_BUCKET, key: "" },
    ...parts.map((label, i) => ({ label, key: parts.slice(0, i + 1).join("/") })),
  ];
}

export type RawKeyParts = { layer: string; sourceId?: string; dt?: string; file?: string };

export function parseKey(key: string): RawKeyParts {
  const parts = key.split("/").filter(Boolean);
  const out: RawKeyParts = { layer: parts[0] ?? "" };
  for (const part of parts.slice(1)) {
    if (part.startsWith("source=")) out.sourceId = part.slice(7);
    else if (part.startsWith("dt=")) out.dt = part.slice(3);
  }
  if (isFileKey(key)) out.file = parts.at(-1);
  return out;
}

export function sourceKey(sourceId: string): string {
  return `raw/source=${sourceId}`;
}
