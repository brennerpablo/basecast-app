import type { LucideIcon } from "lucide-react";
import type * as React from "react";

import { Card } from "@/components/components-app/ui/card";
import type { Caveat, Meta } from "@/lib/bff/envelope";
import { cn } from "@/lib/utils";

import { CaveatBadges } from "./caveat-badges";
import { InfoTip } from "./info-tip";
import { Provenance } from "./provenance";

/**
 * A titled card of a product screen: title, subtitle and an action on top, the caveats under them, the
 * body, and the provenance of `meta` as its footer. With `icon` the title takes the Fundsys section header
 * (the icon in a brand-tinted square, the title in `text-base`), the look screens move to one by one.
 *
 * Keep the subtitle to data (a date, a count, a unit): a definition or a card's own caveat goes in `info`, an
 * icon beside the title with the text in its tooltip. Pass `meta` only when the card's response differs from
 * the screen's, whose provenance shows once at the foot.
 */
export function SectionCard({
  title,
  icon: Icon,
  subtitle,
  info,
  action,
  caveats,
  meta,
  className,
  children,
}: {
  title: React.ReactNode;
  icon?: LucideIcon;
  subtitle?: React.ReactNode;
  info?: React.ReactNode;
  action?: React.ReactNode;
  caveats?: Caveat[] | null;
  meta?: Meta | null;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Card data-slot="section-card" className={cn("flex min-w-0 flex-col", className)}>
      <div className="mb-4 flex items-start gap-3">
        {Icon ? (
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="shrink-0 rounded-md bg-basecast-brand-surface p-1.5">
                <Icon className="size-4 text-basecast-brand" aria-hidden />
              </span>
              <h2 className="text-base font-semibold text-foreground">{title}</h2>
              {info && <InfoTip>{info}</InfoTip>}
            </div>
            {subtitle && <div className="mt-1.5 text-xs text-muted-foreground">{subtitle}</div>}
          </div>
        ) : (
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <h2 className="text-sm font-semibold text-foreground">{title}</h2>
              {info && <InfoTip>{info}</InfoTip>}
            </div>
            {subtitle && <div className="mt-0.5 text-xs text-muted-foreground">{subtitle}</div>}
          </div>
        )}
        {action && <div className="ml-auto shrink-0">{action}</div>}
      </div>
      <CaveatBadges caveats={caveats} className="-mt-1 mb-4" />
      <div className="min-w-0 flex-1">{children}</div>
      {meta && <Provenance meta={meta} className="mt-4 border-t border-border pt-3" />}
    </Card>
  );
}
