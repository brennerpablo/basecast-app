import type * as React from "react";

import { cn } from "@/lib/utils";

/**
 * A dashboard screen's heading, as in Fundsys: the title in slate, a grey line under it, and whatever the
 * screen puts below (the response's caveats, a filter row).
 */
export function PageHeader({
  title,
  subtitle,
  children,
  className,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-3", className)}>
      <div>
        <h1 className="text-2xl font-semibold text-slate-700 dark:text-slate-300">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}

/** A section's label above its cards, as Fundsys's Mercado home. */
export function SectionHeading({ children, className }: { children: React.ReactNode; className?: string }) {
  return <h2 className={cn("text-xs font-semibold tracking-wide text-muted-foreground uppercase", className)}>{children}</h2>;
}
