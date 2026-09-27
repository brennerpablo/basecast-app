"use client";

import {
  DollarSign,
  House,
  IdCard,
  LandPlot,
  type LucideIcon,
  Receipt,
  TrendingUp,
  Users,
  Zap,
} from "lucide-react";

import { AppBadge } from "@/components/components-app/ui/badge";
import { CaveatBadges, SimulatedBadge } from "@/components/product/caveat-badges";
import { FactValue } from "@/components/product/fact-value";
import { KpiStatCard, KpiStatItem } from "@/components/product/kpi-stat-card";
import { PageHeader } from "@/components/product/page-header";
import { ACCOUNT_TYPE_LABEL, type AccountDetail } from "@/lib/accounts/labels";
import { headerText, type KPI_FACT_KEYS } from "@/lib/accounts/summary";
import type { Fact, Meta } from "@/lib/bff/envelope";

import { NextActionBadge } from "../../_components/account-bits";

/**
 * Who they are, as Fundsys's entity header (the CRM company, the counterparty 360): the name, a grey line
 * with type, G&T and counties, the tier, rank and action badges, and the response's caveats.
 */
export function AccountHeader({ account, meta }: { account: AccountDetail; meta: Meta }) {
  const { score } = account;
  const line = [
    ACCOUNT_TYPE_LABEL[account.account_type] ?? account.account_type,
    headerText(account.header, "gt"),
    headerText(account.header, "counties"),
  ]
    .filter(Boolean)
    .join(" · ");
  return (
    <PageHeader
      title={
        <span className="flex flex-wrap items-center gap-2">
          {account.name}
          <SimulatedBadge simulated={account.simulated} />
        </span>
      }
      subtitle={line}
    >
      <div className="flex flex-wrap items-center gap-1.5">
        <AppBadge state="meta">Tier {score.tier}</AppBadge>
        <AppBadge state="meta">
          Rank {score.rank} of {score.n_accounts}
          {score.rank_within_type != null && ` · #${score.rank_within_type} among ${account.account_type === "muni" ? "munis" : "co-ops"}`}
        </AppBadge>
        <NextActionBadge action={account.next_action.action} />
      </div>
      <CaveatBadges caveats={meta.caveats} />
    </PageHeader>
  );
}

const KPI_ICON: Record<(typeof KPI_FACT_KEYS)[number], LucideIcon> = {
  territory_km2: LandPlot,
  customers: Users,
  customer_cagr: TrendingUp,
  sales_mwh: Zap,
  revenue_kusd: DollarSign,
  price: Receipt,
  price_cagr: TrendingUp,
  res_price: House,
};

/** The account's size, sales and prices as the detail page's KPI strip; each value is a Fact (hover for its source). */
export function AccountKpis({ facts }: { facts: Fact[] }) {
  if (!facts.length) return null;
  return (
    <KpiStatCard>
      {facts.map((fact) => (
        <KpiStatItem key={fact.key} icon={KPI_ICON[fact.key as keyof typeof KPI_ICON] ?? IdCard} label={fact.label}>
          <FactValue fact={fact} valueClassName="text-sm font-semibold text-foreground" />
        </KpiStatItem>
      ))}
    </KpiStatCard>
  );
}
