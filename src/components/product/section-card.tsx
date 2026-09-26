import type * as React from "react";

import { Card } from "@/components/components-app/ui/card";
import type { Caveat, Meta } from "@/lib/bff/envelope";
import { cn } from "@/lib/utils";

import { CaveatBadges } from "./caveat-badges";
import { Provenance } from "./provenance";

/**
 * A titled card of a product screen: title, subtitle and an action on top, the caveats under them, the
 * body, and the provenance of `meta` as its footer.
 */
export function SectionCard({
  title,
  subtitle,
  action,
  caveats,
  meta,
  className,
  children,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  action?: React.ReactNode;
  caveats?: Caveat[] | null;
  meta?: Meta | null;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Card className={cn("flex min-w-0 flex-col", className)}>
      <div className="mb-4 flex items-start gap-3">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-foreground">{title}</h2>
          {subtitle && <div className="mt-0.5 text-xs text-muted-foreground">{subtitle}</div>}
        </div>
        {action && <div className="ml-auto shrink-0">{action}</div>}
      </div>
      <CaveatBadges caveats={caveats} className="-mt-1 mb-4" />
      <div className="min-w-0 flex-1">{children}</div>
      {meta && <Provenance meta={meta} className="mt-4 border-t border-border pt-3" />}
    </Card>
  );
}
