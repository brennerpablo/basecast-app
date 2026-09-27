import type { LucideIcon } from "lucide-react";
import type * as React from "react";

import { Card } from "@/components/components-app/ui/card";
import { cn } from "@/lib/utils";

/**
 * The KPI strip of a detail page, ported from Fundsys's `KpiStatCard` (the 360 of a counterparty, the CRM
 * company): one card of icon + label + value items. For dashboards and lists use `DashboardStatCard`; this
 * one is the compact summary of ONE entity.
 */
export function KpiStatCard({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <Card className={cn("grid grid-cols-2 gap-x-4 gap-y-4 p-4 sm:gap-x-8 sm:p-5 lg:grid-cols-4", className)}>{children}</Card>
  );
}

/** One item of the strip: the icon in a grey square, the label, and the value (any node, e.g. a `FactValue`). */
export function KpiStatItem({ icon: Icon, label, children }: { icon: LucideIcon; label: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <div className="shrink-0 rounded-md bg-muted p-2">
        <Icon className="size-4 text-muted-foreground" aria-hidden />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        <div className="mt-0.5 text-sm font-semibold">{children}</div>
      </div>
    </div>
  );
}
