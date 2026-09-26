"use client";

import { SearchX } from "lucide-react";

import EmptyState from "@/components/empty-state";
import { PageBreadcrumb } from "@/components/page-breadcrumb";
import { MartNotBuiltState } from "@/components/product/data-card";
import { Skeleton } from "@/components/ui/skeleton";
import type { AccountDetail } from "@/lib/accounts/labels";
import { BffError, type CaveatCode, isMartNotBuilt } from "@/lib/bff/envelope";
import { useProductQuery } from "@/lib/bff/queries";

import { AccountHeader } from "./account-header";
import { EiaCard, GapsCard } from "./eia-card";
import { NextActionCard } from "./next-action-card";
import { ScoreCard } from "./score-card";
import { TerritoryCard } from "./territory-card";
import { WhyNowCard } from "./why-now-card";

/**
 * /accounts/[id]: the diagnosis of one account (X9), block by block. An unknown id, and any account held
 * back from the scored universe, answers 404 alike: "not found".
 */
export function AccountScreen({ id }: { id: string }) {
  const detail = useProductQuery<AccountDetail>(`accounts/${encodeURIComponent(id)}`, undefined, { throwOnError: false });
  const error = detail.error;
  const notFound = error instanceof BffError && error.status === 404;
  // Anything but a missing mart or an unknown id goes to the route's error.tsx.
  if (error && !detail.data && !notFound && !isMartNotBuilt(error)) throw error;

  const name = detail.data?.data.name;
  const breadcrumb = (
    <PageBreadcrumb items={[{ label: "Accounts", href: "/accounts" }, { label: name ?? (detail.isPending ? "…" : id) }]} />
  );

  if (!detail.data) {
    return (
      <>
        {breadcrumb}
        {isMartNotBuilt(error) ? (
          <MartNotBuiltState mart={error.mart} compact={false} />
        ) : notFound ? (
          <EmptyState Icon={SearchX} title="Account not found" description={`No account in the ranking answers to ${id}.`} />
        ) : (
          <div className="space-y-4">
            <Skeleton className="h-48 w-full" />
            <div className="grid gap-4 lg:grid-cols-3">
              <Skeleton className="h-72" />
              <Skeleton className="h-72 lg:col-span-2" />
            </div>
          </div>
        )}
      </>
    );
  }

  const { data: account, meta } = detail.data;
  const only = (...codes: CaveatCode[]) => meta.caveats?.filter((c) => codes.includes(c.code));
  return (
    <div className="space-y-4">
      {breadcrumb}
      <AccountHeader account={account} meta={meta} />
      <div className="grid gap-4 lg:grid-cols-3">
        <NextActionCard account={account} meta={meta} />
        <WhyNowCard account={account} meta={meta} caveats={only("by_county_not_point")} className="lg:col-span-2" />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <ScoreCard account={account} meta={meta} caveats={only("weights_pending_review")} />
        <GapsCard account={account} meta={meta} />
      </div>
      <TerritoryCard account={account} meta={meta} caveats={only("by_county_not_point")} />
      <EiaCard account={account} meta={meta} />
    </div>
  );
}
