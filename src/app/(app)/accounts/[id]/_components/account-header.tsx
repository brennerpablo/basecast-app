"use client";

import { AppBadge } from "@/components/components-app/ui/badge";
import { SimulatedBadge } from "@/components/product/caveat-badges";
import { FactGrid } from "@/components/product/fact-grid";
import { SectionCard } from "@/components/product/section-card";
import { ACCOUNT_TYPE_LABEL, type AccountDetail } from "@/lib/accounts/labels";
import type { Meta } from "@/lib/bff/envelope";

import { NextActionBadge } from "../../_components/account-bits";

/** Facts the title row already shows. */
const IN_TITLE = new Set(["name", "account_type"]);

/** Who they are: the name with type, tier, rank and action, the response's caveats, and the header facts. */
export function AccountHeader({ account, meta }: { account: AccountDetail; meta: Meta }) {
  const { score } = account;
  return (
    <SectionCard
      title={
        <span className="flex flex-wrap items-center gap-2 text-lg">
          {account.name}
          <SimulatedBadge simulated={account.simulated} />
        </span>
      }
      subtitle={
        <span className="mt-1 flex flex-wrap items-center gap-1.5">
          <AppBadge state="meta">{ACCOUNT_TYPE_LABEL[account.account_type] ?? account.account_type}</AppBadge>
          <AppBadge state="meta">Tier {score.tier}</AppBadge>
          <AppBadge state="meta">
            Rank {score.rank} of {score.n_accounts}
            {score.rank_within_type != null && ` · #${score.rank_within_type} among ${account.account_type === "muni" ? "munis" : "co-ops"}`}
          </AppBadge>
          <NextActionBadge action={account.next_action.action} />
        </span>
      }
      caveats={meta.caveats}
      meta={meta}
    >
      <FactGrid facts={account.header.filter((fact) => !IN_TITLE.has(fact.key))} />
    </SectionCard>
  );
}
