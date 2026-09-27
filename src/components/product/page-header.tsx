import type * as React from "react";

import { cn } from "@/lib/utils";

/**
 * A dashboard screen's heading, as in Fundsys: the title in slate, a grey line under it, the screen's actions
 * on the right, and whatever the screen puts below (badges, the response's caveats).
 */
export function PageHeader({
  title,
  subtitle,
  actions,
  children,
  className,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold text-slate-700 dark:text-slate-300">{title}</h1>
          {subtitle && <div className="mt-1 text-sm text-muted-foreground">{subtitle}</div>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-3">{actions}</div>}
      </div>
      {children}
    </div>
  );
}
