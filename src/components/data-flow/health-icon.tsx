import { CircleCheckIcon, CircleDashedIcon, CircleXIcon, ClockAlertIcon, LoaderCircleIcon, type LucideIcon, TriangleAlertIcon } from "lucide-react";

import { cn } from "@/lib/utils";

import type { DataHealth } from "./health";
import { HEALTH_LABEL } from "./labels";

/** Same tones as the run dots of the /data pages (`RunDot`): emerald success, sky running, amber, red. */
const HEALTH_ICON: Record<DataHealth, { Icon: LucideIcon; className: string }> = {
  healthy: { Icon: CircleCheckIcon, className: "text-emerald-600 dark:text-emerald-400" },
  running: { Icon: LoaderCircleIcon, className: "animate-spin text-sky-500 motion-reduce:animate-none" },
  stale: { Icon: ClockAlertIcon, className: "text-amber-600 dark:text-amber-400" },
  degraded: { Icon: TriangleAlertIcon, className: "text-amber-600 dark:text-amber-400" },
  failed: { Icon: CircleXIcon, className: "text-red-600 dark:text-red-400" },
  never: { Icon: CircleDashedIcon, className: "text-muted-foreground" },
};

export function HealthIcon({ status, className }: { status: DataHealth; className?: string }) {
  const { Icon, className: tone } = HEALTH_ICON[status];
  return <Icon role="img" aria-label={HEALTH_LABEL[status]} className={cn("size-3.5 shrink-0", tone, className)} />;
}
