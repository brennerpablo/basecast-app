import type { LucideIcon } from "lucide-react";
import type * as React from "react";

import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/**
 * One figure in a row of KPIs: a small grey label over a semibold value, with an optional icon in a grey
 * square. Ported from Fundsys's `KpiItem` (Mercado, Liquidez, VaR), where the icon is required.
 */
export function KpiItem({
  icon: Icon,
  label,
  value,
  loading,
  className,
}: {
  icon?: LucideIcon;
  label: React.ReactNode;
  value: React.ReactNode;
  loading?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("flex min-w-0 items-center gap-3", className)}>
      {Icon && (
        <div className="shrink-0 rounded-md bg-muted p-2">
          <Icon className="size-4 text-muted-foreground" aria-hidden />
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        {loading ? (
          <Skeleton className="mt-1 h-4 w-24" />
        ) : (
          <p className="mt-0.5 text-sm font-semibold text-foreground tabular-nums">{value}</p>
        )}
      </div>
    </div>
  );
}
