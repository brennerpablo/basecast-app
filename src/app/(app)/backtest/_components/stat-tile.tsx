"use client";

import type * as React from "react";

import { Card } from "@/components/components-app/ui/card";
import { type FactLike, FactValue } from "@/components/product/fact-value";
import { cn } from "@/lib/utils";

/**
 * One headline number as a stat card, as Fundsys's `DashboardStatCard` (`stacked`): the chart mark it stands
 * for in a grey square, the label, the value as a Fact (source and date one hover away, the "Machine-read, not
 * verified" badge beside it), a caption, and badges of its own.
 */
export function StatTile({
  label,
  fact,
  format,
  caption,
  badges,
  swatch,
  className,
}: {
  label: React.ReactNode;
  fact: FactLike;
  format?: React.ComponentProps<typeof FactValue>["format"];
  caption?: React.ReactNode;
  badges?: React.ReactNode;
  /** The mark this number is in the chart, as its key. */
  swatch?: React.ReactNode;
  className?: string;
}) {
  return (
    <Card accentColor="hsl(var(--brand))" accentSide="left" className={cn("min-w-0 p-4 sm:p-5", className)}>
      <div className="flex items-start gap-3">
        {swatch && (
          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-border bg-muted">{swatch}</div>
        )}
        <div className="min-w-0 flex-1">
          <p className="text-sm leading-snug font-medium text-muted-foreground">{label}</p>
          <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
            <FactValue fact={fact} format={format} valueClassName="text-xl leading-tight font-semibold text-foreground" />
            {badges}
          </div>
          {caption && <div className="mt-1 text-xs text-muted-foreground">{caption}</div>}
        </div>
      </div>
    </Card>
  );
}
