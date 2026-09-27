"use client";

import type { UseQueryResult } from "@tanstack/react-query";
import { CircleAlert, Hammer, Inbox, type LucideIcon } from "lucide-react";
import type * as React from "react";

import EmptyState from "@/components/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { type CaveatCode, type Envelope, isMartNotBuilt, type Meta } from "@/lib/bff/envelope";

import { SectionCard } from "./section-card";

/** The empty state of a view whose mart is not built yet (503 `mart_not_built`): the rest of the page stays. */
export function MartNotBuiltState({ mart, compact = true }: { mart: string; compact?: boolean }) {
  return (
    <EmptyState
      compact={compact}
      Icon={Hammer}
      title="This view is being rebuilt"
      description={`It fills in once the ${mart} mart is built.`}
    />
  );
}

/**
 * A view over one product query, by state:
 * - loading: `skeleton`, a blank block by default;
 * - 503 `mart_not_built`: "This view is being rebuilt", naming the mart, in this view only;
 * - empty (`isEmpty`): an empty state;
 * - any other failure with nothing on screen has gone to the route's `error.tsx` (`useProductQuery`);
 *   a query built elsewhere shows it here.
 * `compact` sizes the empty states for a panel inside a card; a screen without a card around it passes false.
 */
export function QueryBody<T>({
  query,
  isEmpty,
  empty,
  skeleton,
  compact = true,
  children,
}: {
  query: UseQueryResult<Envelope<T>>;
  isEmpty?: (data: T) => boolean;
  empty?: { Icon?: LucideIcon; title: string; description?: string };
  skeleton?: React.ReactNode;
  compact?: boolean;
  children: (data: T, meta: Meta) => React.ReactNode;
}) {
  const envelope = query.data;
  if (envelope) {
    return isEmpty?.(envelope.data) ? (
      <EmptyState compact={compact} Icon={empty?.Icon ?? Inbox} title={empty?.title ?? "Nothing to show"} description={empty?.description} />
    ) : (
      children(envelope.data, envelope.meta)
    );
  }
  if (isMartNotBuilt(query.error)) return <MartNotBuiltState mart={query.error.mart} compact={compact} />;
  if (query.error) {
    return (
      <EmptyState
        compact={compact}
        Icon={CircleAlert}
        iconClassName="text-red-600"
        title="Could not load this view"
        description={query.error.message.replace(/\.?$/, ".")}
      />
    );
  }
  return skeleton ?? <Skeleton className="h-40 w-full" />;
}

/**
 * A card over one product query: the title and the response's caveats on top, the body by state
 * (`QueryBody`), the provenance below.
 */
export function DataCard<T>({
  title,
  subtitle,
  action,
  query,
  isEmpty,
  empty,
  omitCaveats,
  skeleton,
  className,
  children,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  action?: React.ReactNode;
  query: UseQueryResult<Envelope<T>>;
  isEmpty?: (data: T) => boolean;
  empty?: { Icon?: LucideIcon; title: string; description?: string };
  /** Caveats the screen already shows elsewhere (e.g. as a banner), left out of the card's badges. */
  omitCaveats?: CaveatCode[];
  skeleton?: React.ReactNode;
  className?: string;
  children: (data: T, meta: Meta) => React.ReactNode;
}) {
  const envelope = query.data;
  return (
    <SectionCard
      title={title}
      subtitle={subtitle}
      action={action}
      caveats={envelope?.meta.caveats?.filter((caveat) => !omitCaveats?.includes(caveat.code))}
      meta={envelope?.meta}
      className={className}
    >
      <QueryBody query={query} isEmpty={isEmpty} empty={empty} skeleton={skeleton}>
        {children}
      </QueryBody>
    </SectionCard>
  );
}
