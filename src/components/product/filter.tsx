import type * as React from "react";

import { cn } from "@/lib/utils";

/** A labeled control of a filter row, as Fundsys's filter bars: the label above, the control below. */
export function Filter({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      {children}
    </div>
  );
}

/** The row the filters sit in, above a screen's stat cards. */
export function FilterRow({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("flex flex-wrap items-end gap-x-5 gap-y-3", className)}>{children}</div>;
}
