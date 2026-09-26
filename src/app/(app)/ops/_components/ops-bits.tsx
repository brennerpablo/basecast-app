"use client";

import { useQuery } from "@tanstack/react-query";
import { CircleAlert, CircleCheck, CircleX, Clock, type LucideIcon, TriangleAlert } from "lucide-react";
import type * as React from "react";

import { AppBadge, type AppBadgeState } from "@/components/components-app/ui/badge";
import { Card } from "@/components/components-app/ui/card";
import EmptyState from "@/components/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { BRAND_CSS } from "@/lib/brand-tokens";
import { type HealthStatus, OPS_RANGES, type OpsLevel, type OpsRange, type OpsService } from "@/lib/ops/types";
import { cn } from "@/lib/utils";

/** The screen refetches on this interval while the browser tab is visible. */
export const OPS_REFETCH_MS = 30_000;

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error ?? `The server answered ${res.status}`);
  }
  return (await res.json()) as T;
}

/** A polled /api/ops read. `null` url pauses it. */
export function useOpsQuery<T>(key: readonly unknown[], url: string | null) {
  return useQuery({
    queryKey: ["ops", ...key],
    queryFn: () => getJson<T>(url!),
    enabled: url !== null,
    refetchInterval: OPS_REFETCH_MS,
    refetchIntervalInBackground: false,
    staleTime: 0,
  });
}

/** Left-accent colors of the KPI cards, as in the Fundsys app with BaseCast's brand in place of its green. */
export const ACCENT = {
  brand: BRAND_CSS.brand,
  blue: "#3b82f6",
  amber: "#f59e0b",
  red: "#ef4444",
  muted: "hsl(var(--muted-foreground) / 0.4)",
} as const;

export const HEALTH_ACCENT: Record<HealthStatus, string> = {
  healthy: ACCENT.brand,
  degraded: ACCENT.amber,
  stalled: ACCENT.red,
  idle: ACCENT.muted,
};

/** Colors from the validated categorical palette (dataviz skill), one per service. */
export const SERVICE_COLOR: Record<OpsService, string> = {
  app: "#2a78d6",
  "get-data": "#eb6834",
  airflow: "#1baf7a",
};

export function ServiceLabel({ service, className }: { service: OpsService; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-xs whitespace-nowrap", className)}>
      <span className="size-2 shrink-0 rounded-[2px]" style={{ background: SERVICE_COLOR[service] }} />
      <span className="font-mono">{service}</span>
    </span>
  );
}

const HEALTH: Record<HealthStatus, { state: AppBadgeState; label: string; Icon: LucideIcon }> = {
  healthy: { state: "active", label: "Healthy", Icon: CircleCheck },
  degraded: { state: "alert", label: "Degraded", Icon: TriangleAlert },
  stalled: { state: "critical", label: "Stalled", Icon: CircleX },
  idle: { state: "inactive", label: "Idle", Icon: Clock },
};

export function HealthBadge({ status }: { status: HealthStatus }) {
  const { state, label, Icon } = HEALTH[status];
  return (
    <AppBadge state={state} className="gap-1">
      <Icon className="size-3" />
      {label}
    </AppBadge>
  );
}

const LEVEL: Record<OpsLevel, AppBadgeState> = { error: "critical", warn: "alert", info: "meta" };

export function LevelBadge({ level }: { level: OpsLevel }) {
  return (
    <AppBadge state={LEVEL[level]} className="font-mono text-[10px] font-semibold tracking-wide uppercase">
      {level}
    </AppBadge>
  );
}

export const RUN_STATUS_LABEL: Record<string, string> = {
  success: "Succeeded",
  partial: "Partial",
  failed: "Failed",
  abandoned: "Abandoned",
  running: "Running",
};

const RUN_STATE: Record<string, AppBadgeState> = {
  success: "active",
  partial: "alert",
  failed: "critical",
  abandoned: "inactive",
  running: "processing",
};

export function RunStatusBadge({ status }: { status: string }) {
  return <AppBadge state={RUN_STATE[status] ?? "meta"}>{RUN_STATUS_LABEL[status] ?? status}</AppBadge>;
}

export const RANGE_LABEL: Record<OpsRange, string> = {
  "1h": "last hour",
  "24h": "last 24 h",
  "7d": "last 7 days",
  "30d": "last 30 days",
};

const RANGE_BUTTON: Record<OpsRange, string> = { "1h": "1 h", "24h": "24 h", "7d": "7 days", "30d": "30 days" };

/** The Fundsys range toggle: a bordered strip, the chosen range in solid foreground. */
export function RangeToggle({ value, onChange }: { value: OpsRange; onChange: (range: OpsRange) => void }) {
  return (
    <div role="group" aria-label="Time range" className="inline-flex items-center gap-1 rounded-md border border-border bg-card p-1">
      {OPS_RANGES.map((r) => (
        <button
          key={r}
          type="button"
          aria-pressed={value === r}
          onClick={() => onChange(r)}
          className={cn(
            "rounded px-2.5 py-1 text-xs font-medium transition-colors",
            value === r ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground",
          )}
        >
          {RANGE_BUTTON[r]}
        </button>
      ))}
    </div>
  );
}

/** A KPI card as on the Fundsys pipelines screen: left accent, icon tile, big number, label, note. */
export function KpiCard({
  Icon,
  iconClassName,
  value,
  label,
  note,
  accent,
  isLoading,
  badge,
}: {
  Icon: LucideIcon;
  iconClassName?: string;
  value: React.ReactNode;
  label: React.ReactNode;
  note?: React.ReactNode;
  accent: string;
  isLoading?: boolean;
  badge?: React.ReactNode;
}) {
  return (
    <Card accentColor={accent} accentSide="left" className="h-full">
      <div className="flex items-center gap-3">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-border bg-muted text-foreground">
          <Icon className={cn("size-4", iconClassName)} />
        </div>
        {isLoading ? (
          <Skeleton className="h-7 w-14" />
        ) : (
          <div className="text-2xl leading-none font-semibold text-foreground tabular-nums">{value}</div>
        )}
        {badge && !isLoading && <div className="ml-auto">{badge}</div>}
      </div>
      <div className="mt-2 text-sm text-muted-foreground">{label}</div>
      <div className="mt-1 text-xs text-muted-foreground">
        {isLoading ? <Skeleton className="h-3 w-32" /> : (note ?? "—")}
      </div>
    </Card>
  );
}

/** A titled section, as the Fundsys admin screens frame their charts and tables. */
export function SectionCard({
  title,
  subtitle,
  action,
  className,
  children,
}: {
  title: string;
  subtitle?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Card className={cn("flex flex-col", className)}>
      <div className="mb-4 flex items-start gap-3">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-foreground">{title}</h2>
          {subtitle && <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>}
        </div>
        {action && <div className="ml-auto shrink-0">{action}</div>}
      </div>
      {children}
    </Card>
  );
}

/** Chart placeholder while loading: the baseline only, as the Fundsys charts do. */
export function ChartSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("flex w-full flex-col justify-end pb-2", className)}>
      <div className="h-px bg-border" />
    </div>
  );
}

export function LoadError({ error }: { error: Error }) {
  return (
    <EmptyState
      compact
      Icon={CircleAlert}
      iconClassName="text-red-600"
      title="Could not load this view"
      description={`${error.message}. It tries again every ${OPS_REFETCH_MS / 1_000} s.`}
    />
  );
}

/** A labelled value in a detail sheet: uppercase label over the value, as in the Fundsys log sheet. */
export function Field({ label, value, mono }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div>
      <div className="mb-1 text-xs font-medium tracking-wide text-muted-foreground uppercase">{label}</div>
      <div className={mono ? "font-mono text-xs break-all" : "wrap-break-word"}>{value}</div>
    </div>
  );
}

export function FieldBlock({ label, children, tone }: { label: string; children: React.ReactNode; tone?: "error" }) {
  return (
    <div>
      <div className={cn("mb-1.5 text-xs font-medium tracking-wide uppercase", tone === "error" ? "text-red-600" : "text-muted-foreground")}>
        {label}
      </div>
      {children}
    </div>
  );
}
