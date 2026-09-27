/** Display helpers for /ops. Times show in Chicago (the project's display zone), labelled CT. */

const TZ = "America/Chicago";

const timeFmt = new Intl.DateTimeFormat("en-US", {
  timeZone: TZ, hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
});
const dayTimeFmt = new Intl.DateTimeFormat("en-US", {
  timeZone: TZ, month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
});
const dayFmt = new Intl.DateTimeFormat("en-US", { timeZone: TZ, month: "short", day: "numeric" });
const hourFmt = new Intl.DateTimeFormat("en-US", {
  timeZone: TZ, hour: "2-digit", minute: "2-digit", hourCycle: "h23",
});

export const fmtInt = (n: number) => Math.round(n).toLocaleString("en-US");

/** `14:32:04.118` */
export function fmtLogTime(iso: string): string {
  const d = new Date(iso);
  return `${timeFmt.format(d)}.${String(d.getMilliseconds()).padStart(3, "0")}`;
}

/** `Sep 26, 14:32:04.118` */
export const fmtDayLogTime = (iso: string) => `${dayFmt.format(new Date(iso))}, ${fmtLogTime(iso)}`;

/** `Sep 26, 14:32` */
export const fmtDayTime = (iso: string) => dayTimeFmt.format(new Date(iso));

/** Chart axis label for a bucket start: the hour for short buckets, the day for daily ones. */
export function fmtBucket(iso: string, bucketMs: number): string {
  const d = new Date(iso);
  if (bucketMs >= 86_400_000) return dayFmt.format(d);
  if (bucketMs >= 6 * 3_600_000) return `${dayFmt.format(d)} ${hourFmt.format(d)}`;
  return hourFmt.format(d);
}

/** `412 ms`, `1.91 s`, `2 min 31 s` */
export function fmtDuration(ms: number | null | undefined): string {
  if (ms === null || ms === undefined) return "—";
  if (ms < 1_000) return `${Math.round(ms)} ms`;
  if (ms < 60_000) return `${(ms / 1_000).toFixed(ms < 10_000 ? 2 : 1)} s`;
  const min = Math.floor(ms / 60_000);
  return `${min} min ${Math.round((ms % 60_000) / 1_000)} s`;
}

/** `3 s ago`, `14 min ago`, `2 h ago`, `Sep 24` */
export function fmtAgo(iso: string | null, now = Date.now()): string {
  if (!iso) return "never";
  const s = Math.max(0, Math.round((now - Date.parse(iso)) / 1_000));
  if (s < 60) return `${s} s ago`;
  if (s < 3_600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86_400) return `${Math.floor(s / 3_600)} h ago`;
  return dayFmt.format(new Date(iso));
}
