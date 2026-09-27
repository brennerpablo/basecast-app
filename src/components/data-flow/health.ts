/**
 * How fresh each source's data is: its latest run, when it last updated, and whether a scheduled run
 * (`schedule_cron`, America/Chicago) has been missed since. Pure, so the flow screen and its tests agree.
 */

import { formatDateTime } from "@/components/data-browser/format";

export const DATA_HEALTH = ["healthy", "running", "stale", "degraded", "failed", "never"] as const;
export type DataHealth = (typeof DATA_HEALTH)[number];

/** How long after a scheduled time the data may still be old before it counts as stale (the run's own time). */
export const HEALTH_GRACE_MS = 6 * 60 * 60 * 1000;

/** Worst first: a group of nodes shows the worst health among them. */
const SEVERITY: Record<DataHealth, number> = { failed: 5, degraded: 4, stale: 3, running: 2, never: 1, healthy: 0 };

export type HealthVerdict = {
  status: DataHealth;
  /** A short line for the node's tooltip; the side panel shows it only when it adds to the status label. */
  reason: string;
  /** When the data last updated (ISO, UTC), or null when it never did. */
  updatedAt: string | null;
  /** The scheduled run the data was due by, when there is a schedule and an update. */
  dueAt: string | null;
};

/** The latest run of one stage, as `etl_run` records it. */
export type StageRun = { status: string; started_at: string; finished_at?: string | null };

/**
 * The health of one stage of a source (raw fetch or process): the latest run decides first (running,
 * failed, abandoned), then the schedule: a success older than the next scheduled time plus the grace
 * is stale. A source without a schedule (manual) never goes stale.
 */
export function stageHealth({
  cron,
  latest,
  lastSuccessAt,
  now,
}: {
  cron: string | null | undefined;
  latest: StageRun | null | undefined;
  lastSuccessAt: string | null | undefined;
  now: Date;
}): HealthVerdict {
  const updatedAt = lastSuccessAt ?? null;
  const due = updatedAt && cron ? nextCronRun(cron, new Date(updatedAt)) : null;
  const dueAt = due ? due.toISOString() : null;
  const base = { updatedAt, dueAt };

  if (latest?.status === "running") {
    return { ...base, status: "running", reason: "Running." };
  }
  if (latest?.status === "failed") {
    return { ...base, status: "failed", reason: "Latest run failed." };
  }
  if (latest?.status === "abandoned" || latest?.status === "partial") {
    return { ...base, status: "degraded", reason: `Latest run ${latest.status}.` };
  }
  if (!updatedAt) return { ...base, status: "never", reason: "Never updated." };
  if (!cron) return { ...base, status: "healthy", reason: "Manual." };
  if (!due) return { ...base, status: "healthy", reason: "Updated; the schedule could not be read." };
  if (now.getTime() > due.getTime() + HEALTH_GRACE_MS) {
    return { ...base, status: "stale", reason: "Overdue." };
  }
  return { ...base, status: "healthy", reason: `Up to date. Next scheduled run ${formatDateTime(dueAt)}.` };
}

/** The worst verdict of a group (an origin's sources, a table's writers), with its latest update. */
export function worstHealth(verdicts: HealthVerdict[]): HealthVerdict {
  if (verdicts.length === 0) return { status: "never", reason: "Never updated.", updatedAt: null, dueAt: null };
  const worst = verdicts.reduce((a, b) => (SEVERITY[b.status] > SEVERITY[a.status] ? b : a));
  const updatedAt = verdicts.reduce<string | null>(
    (latest, v) => (v.updatedAt && (!latest || v.updatedAt > latest) ? v.updatedAt : latest),
    null,
  );
  return { ...worst, updatedAt };
}

// --- cron -----------------------------------------------------------------------------------------------

type CronFields = {
  minutes: number[];
  hours: number[];
  days: Set<number> | null;
  months: Set<number> | null;
  weekdays: Set<number> | null;
};

function parseField(field: string, min: number, max: number): number[] | null {
  const values = new Set<number>();
  for (const part of field.split(",")) {
    const [range, stepText] = part.split("/");
    const step = stepText === undefined ? 1 : Number(stepText);
    let lo: number;
    let hi: number;
    if (range === "*") [lo, hi] = [min, max];
    else if (range.includes("-")) [lo, hi] = range.split("-").map(Number) as [number, number];
    else [lo, hi] = [Number(range), stepText === undefined ? Number(range) : max];
    if (![lo, hi, step].every(Number.isInteger) || step < 1 || lo < min || hi > max || lo > hi) return null;
    for (let v = lo; v <= hi; v += step) values.add(v);
  }
  return [...values].sort((a, b) => a - b);
}

function parseCron(cron: string): CronFields | null {
  const fields = cron.trim().split(/\s+/);
  if (fields.length !== 5) return null;
  const [m, h, dom, mon, dow] = fields;
  const minutes = parseField(m, 0, 59);
  const hours = parseField(h, 0, 23);
  const days = parseField(dom, 1, 31);
  const months = parseField(mon, 1, 12);
  const weekdays = parseField(dow, 0, 7);
  if (!minutes || !hours || !days || !months || !weekdays) return null;
  return {
    minutes,
    hours,
    days: dom === "*" ? null : new Set(days),
    months: mon === "*" ? null : new Set(months),
    // Sunday is both 0 and 7.
    weekdays: dow === "*" ? null : new Set(weekdays.map((d) => d % 7)),
  };
}

const partsFormatters = new Map<string, Intl.DateTimeFormat>();

/** The wall clock of `date` in `timeZone`, as numbers. */
function wallClock(date: Date, timeZone: string) {
  let format = partsFormatters.get(timeZone);
  if (!format) {
    format = new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "numeric",
      minute: "numeric",
      hourCycle: "h23",
    });
    partsFormatters.set(timeZone, format);
  }
  const parts = Object.fromEntries(format.formatToParts(date).map((p) => [p.type, p.value]));
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour),
    minute: Number(parts.minute),
  };
}

/** The UTC instant of a wall-clock time in `timeZone` (on a DST edge, one of the two candidates). */
function fromWallClock(year: number, month: number, day: number, hour: number, minute: number, timeZone: string): Date {
  const asUtc = Date.UTC(year, month - 1, day, hour, minute);
  const offset = (t: number) => {
    const w = wallClock(new Date(t), timeZone);
    return Date.UTC(w.year, w.month - 1, w.day, w.hour, w.minute) - t;
  };
  const first = asUtc - offset(asUtc);
  const second = asUtc - offset(first);
  return new Date(Math.max(first, second));
}

/**
 * The first time `cron` fires strictly after `after`, read in `timeZone` (five fields: minute, hour, day of
 * month, month, day of week; `*`, lists, ranges and steps). When both day fields are set, either matches,
 * as in cron. Null for an expression it cannot read or that never fires within ~4 years.
 */
export function nextCronRun(cron: string, after: Date, timeZone = "America/Chicago"): Date | null {
  const spec = parseCron(cron);
  if (!spec) return null;
  const start = wallClock(after, timeZone);
  for (let offset = 0; offset < 1500; offset += 1) {
    const day = new Date(Date.UTC(start.year, start.month - 1, start.day + offset));
    const [y, mo, d, wd] = [day.getUTCFullYear(), day.getUTCMonth() + 1, day.getUTCDate(), day.getUTCDay()];
    if (spec.months && !spec.months.has(mo)) continue;
    const domOk = !spec.days || spec.days.has(d);
    const dowOk = !spec.weekdays || spec.weekdays.has(wd);
    const dayOk = spec.days && spec.weekdays ? domOk || dowOk : domOk && dowOk;
    if (!dayOk) continue;
    for (const h of spec.hours) {
      for (const m of spec.minutes) {
        const candidate = fromWallClock(y, mo, d, h, m, timeZone);
        if (candidate.getTime() > after.getTime()) return candidate;
      }
    }
  }
  return null;
}
