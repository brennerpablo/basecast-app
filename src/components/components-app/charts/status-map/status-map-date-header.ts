import { format } from "date-fns";
import { enUS } from "date-fns/locale";

import type { StatusMapDateHeader } from "./types";

export type StatusMapMonthGroup = {
  key: string;
  label: string;
  dates: string[];
};

export function formatStatusMapMonthLabel(dateIso: string): string {
  const d = new Date(`${dateIso}T00:00:00`);
  const month = format(d, "MMM", { locale: enUS }).replace(/\./g, "").toLowerCase();
  const year = format(d, "yy", { locale: enUS });
  return `${month}/${year}`;
}

export function buildStatusMapMonthGroups(sortedDates: string[]): StatusMapMonthGroup[] {
  const groups: StatusMapMonthGroup[] = [];
  for (const date of sortedDates) {
    const key = date.slice(0, 7);
    const last = groups[groups.length - 1];
    if (last?.key === key) {
      last.dates.push(date);
    } else {
      groups.push({ key, label: formatStatusMapMonthLabel(date), dates: [date] });
    }
  }
  return groups;
}

export function resolveShowMonthHeaderRow(
  sortedDates: string[],
  dateHeader: StatusMapDateHeader,
): boolean {
  if (dateHeader === "day-only") return false;
  if (dateHeader === "month-and-day") return sortedDates.length > 0;
  const groups = buildStatusMapMonthGroups(sortedDates);
  return groups.length > 1;
}

export function isFirstDateOfMonthGroup(
  date: string,
  groups: StatusMapMonthGroup[],
): { isFirst: boolean; groupIndex: number } {
  for (let i = 0; i < groups.length; i++) {
    if (groups[i].dates[0] === date) {
      return { isFirst: true, groupIndex: i };
    }
    if (groups[i].dates.includes(date)) {
      return { isFirst: false, groupIndex: i };
    }
  }
  return { isFirst: false, groupIndex: 0 };
}
