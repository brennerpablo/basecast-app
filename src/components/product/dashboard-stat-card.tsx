"use client";

import type * as React from "react";

import { Card } from "@/components/components-app/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/** The accent of a stat card: Base's lime, or orange when the number is an alert. */
const ACCENT = "hsl(var(--brand))";
const ALERT_ACCENT = "#f97316";

/**
 * One number of a dashboard or list, ported from Fundsys's `DashboardStatCard`: the icon in a grey square,
 * the title and the value, the accent on the left edge. `row` (the default) puts the value at the end of the
 * title's line; `stacked` puts it under the title, for text values, with an optional `hint` below. With
 * `onClick` the card is a toggle (a list's quick filter): `isActive` rings it and sets `aria-pressed`.
 */
export function DashboardStatCard({
  icon,
  title,
  value,
  hint,
  layout = "row",
  isLoading = false,
  isAlert = false,
  onClick,
  isActive = false,
  className,
}: {
  icon: React.ReactNode;
  title: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  layout?: "row" | "stacked";
  isLoading?: boolean;
  isAlert?: boolean;
  onClick?: () => void;
  isActive?: boolean;
  className?: string;
}) {
  const interactive = Boolean(onClick) && !isLoading;
  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (!interactive || (event.key !== "Enter" && event.key !== " ")) return;
    event.preventDefault();
    onClick?.();
  };
  const stacked = layout === "stacked";
  const valueEl = isLoading ? (
    <Skeleton className={cn("h-6", stacked ? "mt-1 w-24" : "w-12")} />
  ) : (
    <div className={cn("font-semibold text-foreground tabular-nums", stacked ? "text-xl leading-tight" : "text-2xl")}>{value}</div>
  );
  return (
    <Card
      accentColor={isAlert && !isLoading ? ALERT_ACCENT : ACCENT}
      accentSide="left"
      hoverShadow={interactive}
      role={interactive ? "button" : undefined}
      tabIndex={interactive ? 0 : undefined}
      aria-pressed={interactive ? isActive : undefined}
      onClick={interactive ? onClick : undefined}
      onKeyDown={onKeyDown}
      className={cn(
        "p-4 sm:p-5",
        interactive && "cursor-pointer transition-colors hover:bg-muted/30",
        isActive && "ring-2 ring-basecast-brand/40",
        className,
      )}
    >
      <div className={cn("flex gap-3", stacked ? "items-start" : "items-center")}>
        <div
          className={cn(
            "flex shrink-0 items-center justify-center rounded-lg border border-border bg-muted text-foreground",
            // A row card drops its icon on a phone, two to a row, so the title and the number keep the width.
            stacked ? "size-9" : "size-10 max-sm:hidden",
          )}
        >
          {icon}
        </div>
        {stacked ? (
          <div className="min-w-0 flex-1">
            <p className="text-sm leading-snug font-medium text-muted-foreground">{title}</p>
            {valueEl}
            {hint && !isLoading && <div className="mt-1 text-xs text-muted-foreground">{hint}</div>}
          </div>
        ) : (
          <div className="flex min-w-0 flex-1 items-center justify-between gap-3">
            <p className="truncate text-sm font-medium text-muted-foreground sm:text-base">{title}</p>
            {valueEl}
          </div>
        )}
      </div>
    </Card>
  );
}
