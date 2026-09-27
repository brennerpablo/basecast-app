"use client";

import { ChartColumn, Clock, Gauge, Handshake, IdCard, LayoutDashboard, type LucideIcon, MapPinned, SearchX } from "lucide-react";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/components-app/ui/tabs";
import EmptyState from "@/components/empty-state";
import { PageBreadcrumb } from "@/components/page-breadcrumb";
import { MartNotBuiltState } from "@/components/product/data-card";
import { Provenance } from "@/components/product/provenance";
import { Skeleton } from "@/components/ui/skeleton";
import type { AccountDetail } from "@/lib/accounts/labels";
import { splitHeaderFacts } from "@/lib/accounts/summary";
import { BffError, type CaveatCode, isMartNotBuilt } from "@/lib/bff/envelope";
import { useProductQuery } from "@/lib/bff/queries";

import { AccountHeader, AccountKpis } from "./account-header";
import { EiaTab } from "./eia-tab";
import { MarketTab } from "./market-tab";
import { OverviewTab } from "./overview-tab";
import { ProfileTab } from "./profile-tab";
import { ScoreTab } from "./score-tab";
import { TerritoryTab } from "./territory-tab";
import { WhyNowTab } from "./why-now-tab";

/** The detail's tabs, in the X9 order, each with its glyph as the Fundsys entity pages. */
const TABS: { value: string; label: string; icon: LucideIcon }[] = [
  { value: "overview", label: "Overview", icon: LayoutDashboard },
  { value: "why-now", label: "Why now", icon: Clock },
  { value: "score", label: "Score", icon: Gauge },
  { value: "territory", label: "Territory", icon: MapPinned },
  { value: "market", label: "Wholesale & 4CP", icon: Handshake },
  { value: "eia", label: "EIA series", icon: ChartColumn },
  { value: "profile", label: "Profile", icon: IdCard },
];

function AccountSkeleton() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-8 w-80" />
        <Skeleton className="h-4 w-56" />
      </div>
      <Skeleton className="h-32 w-full" />
      <Skeleton className="h-9 w-full" />
      <div className="grid gap-4 lg:grid-cols-3">
        <Skeleton className="h-72" />
        <Skeleton className="h-72 lg:col-span-2" />
      </div>
    </div>
  );
}

/**
 * /accounts/[id]: the diagnosis of one account (X9), as Fundsys's entity page: the header, the KPI strip and
 * one tab per part (`?tab=`), each laid out on its own; the provenance once, at the foot. An unknown id, and any
 * account held back from the scored universe, answers 404 alike: "not found".
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
          <AccountSkeleton />
        )}
      </>
    );
  }

  const { data: account, meta } = detail.data;
  const only = (...codes: CaveatCode[]) => meta.caveats?.filter((c) => codes.includes(c.code));
  const { kpis, profile } = splitHeaderFacts(account.header);
  return (
    <div className="space-y-6">
      {breadcrumb}
      <AccountHeader account={account} meta={meta} />
      <AccountKpis facts={kpis} />
      <Tabs urlParam="tab" defaultValue="overview" className="space-y-6">
        <TabsList variant="line" color="brand" className="max-w-full overflow-x-auto">
          {TABS.map(({ value, label, icon: Icon }) => (
            <TabsTrigger key={value} value={value} className="shrink-0">
              <Icon className="mr-1.5 size-3.5" aria-hidden />
              {label}
            </TabsTrigger>
          ))}
        </TabsList>
        <TabsContent value="overview">
          <OverviewTab account={account} />
        </TabsContent>
        <TabsContent value="why-now">
          <WhyNowTab account={account} caveats={only("by_county_not_point")} />
        </TabsContent>
        <TabsContent value="score">
          <ScoreTab account={account} caveats={only("weights_pending_review")} />
        </TabsContent>
        <TabsContent value="territory">
          <TerritoryTab account={account} caveats={only("by_county_not_point")} />
        </TabsContent>
        <TabsContent value="market">
          <MarketTab account={account} supplierCaveats={only("requests_not_forecasts")} fourCpCaveats={only("optimistic_weather")} />
        </TabsContent>
        <TabsContent value="eia">
          <EiaTab account={account} />
        </TabsContent>
        <TabsContent value="profile">
          <ProfileTab facts={profile} city={account.city} />
        </TabsContent>
      </Tabs>
      <Provenance meta={meta} className="border-t border-border pt-3" />
    </div>
  );
}
