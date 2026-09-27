"use client";

import type { UseQueryResult } from "@tanstack/react-query";
import type { LucideIcon } from "lucide-react";
import * as React from "react";

import { Card } from "@/components/components-app/ui/card";
import { CaveatBadges } from "@/components/product/caveat-badges";
import { CardOpenLink, DashboardCardHeader } from "@/components/product/dashboard-card-header";
import { QueryBody } from "@/components/product/data-card";
import { Provenance } from "@/components/product/provenance";
import type { Envelope, Meta } from "@/lib/bff/envelope";
import { cn } from "@/lib/utils";

/**
 * The page's data date: the one most of the cards' responses share (the latest on a tie), or null when none
 * has a date. The home screen shows it once at its foot.
 */
export function commonAsOf(dates: (string | null | undefined)[]): string | null {
  const counts = new Map<string, number>();
  for (const date of dates) if (date) counts.set(date, (counts.get(date) ?? 0) + 1);
  let best: string | null = null;
  for (const [date, n] of counts) {
    const bestN = best ? (counts.get(best) ?? 0) : 0;
    if (n > bestN || (n === bestN && best !== null && date > best)) best = date;
  }
  return best;
}

/** The home screen's data date, for the cards to leave out when theirs is the same. */
export const HomeAsOfContext = React.createContext<string | null>(null);

/**
 * One module's highlight on the home screen: the icon tile header with the link to the module, the body by
 * the query's state (`QueryBody`, so a view being rebuilt empties this card only), and a footer with the
 * response's caveats, plus its data date when it differs from the page's.
 */
export function HomeCard<T>({
  icon: Icon,
  title,
  subtitle,
  href,
  linkLabel,
  query,
  isEmpty,
  empty,
  skeleton,
  className,
  children,
}: {
  icon: LucideIcon;
  title: string;
  subtitle?: React.ReactNode;
  href: string;
  linkLabel: string;
  query: UseQueryResult<Envelope<T>>;
  isEmpty?: (data: T) => boolean;
  empty?: { title: string; description?: string };
  skeleton?: React.ReactNode;
  className?: string;
  children: (data: T, meta: Meta) => React.ReactNode;
}) {
  const pageAsOf = React.useContext(HomeAsOfContext);
  const meta = query.data?.meta;
  const ownDate = meta?.data_as_of && pageAsOf && meta.data_as_of !== pageAsOf;
  return (
    <Card className={cn("flex min-w-0 flex-col", className)}>
      <DashboardCardHeader
        icon={<Icon className="size-5" aria-hidden />}
        title={title}
        subtitle={subtitle}
        trailing={<CardOpenLink href={href} label={linkLabel} />}
      />
      <div className="mt-5 min-w-0 flex-1">
        <QueryBody<T> query={query} isEmpty={isEmpty} empty={empty} skeleton={skeleton}>
          {children}
        </QueryBody>
      </div>
      {meta && (ownDate || !!meta.caveats?.length) && (
        <div className="mt-5 flex flex-wrap items-center gap-x-3 gap-y-1.5 border-t border-border pt-3">
          {ownDate && <Provenance meta={meta} />}
          <CaveatBadges caveats={meta.caveats} />
        </div>
      )}
    </Card>
  );
}
