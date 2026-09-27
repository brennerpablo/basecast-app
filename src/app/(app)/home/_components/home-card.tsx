"use client";

import type { UseQueryResult } from "@tanstack/react-query";
import type { LucideIcon } from "lucide-react";
import type * as React from "react";

import { Card } from "@/components/components-app/ui/card";
import { CaveatBadges } from "@/components/product/caveat-badges";
import { CardOpenLink, DashboardCardHeader } from "@/components/product/dashboard-card-header";
import { QueryBody } from "@/components/product/data-card";
import { formatDate } from "@/components/product/format";
import type { Envelope, Meta } from "@/lib/bff/envelope";
import { cn } from "@/lib/utils";

/**
 * One module's highlight on the home screen: the icon tile header with the link to the module, the body by
 * the query's state (`QueryBody`, so a mart being rebuilt empties this card only), and a footer with the
 * data date and the response's caveats.
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
  const meta = query.data?.meta;
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
      {meta && (
        <div className="mt-5 flex flex-wrap items-center gap-x-3 gap-y-1.5 border-t border-border pt-3">
          <span className="text-xs text-muted-foreground">
            Data as of <span className="text-foreground/80">{formatDate(meta.data_as_of)}</span>
          </span>
          <CaveatBadges caveats={meta.caveats} />
        </div>
      )}
    </Card>
  );
}
