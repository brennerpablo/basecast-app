"use client";

import { useQuery } from "@tanstack/react-query";
import { CircleCheck, CircleX, Clock, TriangleAlert } from "lucide-react";

import { AppBadge, type AppBadgeState } from "@/components/components-app/ui/badge";
import type { HealthStatus, OpsLevel, OpsRange, OpsService } from "@/lib/ops/types";
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
    staleTime: 0,
  });
}

/** Colors from the validated categorical palette (dataviz skill), one per service. */
export const SERVICE_COLOR: Record<OpsService, string> = {
  app: "#2a78d6",
  "get-data": "#eb6834",
  airflow: "#1baf7a",
};

export function ServiceLabel({ service, className }: { service: OpsService; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 whitespace-nowrap text-xs", className)}>
      <span className="size-2 shrink-0 rounded-[2px]" style={{ background: SERVICE_COLOR[service] }} />
      {service}
    </span>
  );
}

const HEALTH: Record<HealthStatus, { state: AppBadgeState; label: string; Icon: typeof CircleCheck }> = {
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
    <AppBadge state={LEVEL[level]} className="font-mono text-[10px] font-bold tracking-wide uppercase">
      {level}
    </AppBadge>
  );
}

const RUN: Record<string, { state: AppBadgeState; label: string }> = {
  success: { state: "active", label: "Succeeded" },
  partial: { state: "alert", label: "Partial" },
  failed: { state: "critical", label: "Failed" },
  abandoned: { state: "inactive", label: "Abandoned" },
  running: { state: "processing", label: "Running" },
};

export function RunStatusBadge({ status }: { status: string }) {
  const { state, label } = RUN[status] ?? { state: "meta" as const, label: status };
  return <AppBadge state={state}>{label}</AppBadge>;
}

export const RANGE_LABEL: Record<OpsRange, string> = {
  "1h": "last hour",
  "24h": "last 24 h",
  "7d": "last 7 days",
  "30d": "last 30 days",
};

/** Loading and failure states shared by the four tabs. */
export function QueryState({ isLoading, error }: { isLoading: boolean; error: Error | null }) {
  if (error) {
    return (
      <p className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
        Could not load this view: {error.message}. It tries again every 30 s.
      </p>
    );
  }
  if (isLoading) return <p className="py-8 text-center text-sm text-muted-foreground">Loading…</p>;
  return null;
}
