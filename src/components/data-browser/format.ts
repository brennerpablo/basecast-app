/** Numbers and times on the /data pages. Times show in America/Chicago, the grid's own clock. */

const INT = new Intl.NumberFormat("en-US");

export function formatCount(value: number | null | undefined): string {
  return value === null || value === undefined ? "—" : INT.format(value);
}

/** Decimal units, as the bucket and the pipelines report them (3.52 GB, 675 KB). */
export function formatBytes(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let n = value;
  let i = 0;
  while (n >= 1000 && i < units.length - 1) {
    n /= 1000;
    i += 1;
  }
  const digits = i === 0 || n >= 100 ? 0 : n >= 10 ? 1 : 2;
  return `${Number(n.toFixed(digits))} ${units[i]}`;
}

const CT = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/Chicago",
  month: "short",
  day: "numeric",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
  timeZoneName: "short",
});

/** `Sep 26, 2026, 00:07 CDT`. */
export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? "—" : CT.format(date);
}

/** `2014-05 → 2026-08` for monthly folders, the date alone for a single one. */
export function formatDtRange(first: string | null | undefined, last: string | null | undefined): string {
  if (!first || !last) return "—";
  if (first === last) return first;
  return `${first.slice(0, 7)} → ${last.slice(0, 7)}`;
}

/** Keeps both ends of long raw file names (`RPT.0001…GIS_Report_August2026.xlsx`). */
export function middleTruncate(text: string, max = 60): string {
  if (text.length <= max) return text;
  const head = Math.floor((max - 1) * 0.38);
  return `${text.slice(0, head)}…${text.slice(-(max - 1 - head))}`;
}

/** A cell as the grid shows it: UTC timestamps read as `2018-01-01 00:00:00 UTC`, the rest as text. */
export function formatCellText(value: unknown): string {
  if (value === null || value === undefined) return "";
  const text = String(value);
  const utc = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2}:\d{2})(\.\d+)?(\+00:00|Z)$/.exec(text);
  return utc ? `${utc[1]} ${utc[2]} UTC` : text;
}
