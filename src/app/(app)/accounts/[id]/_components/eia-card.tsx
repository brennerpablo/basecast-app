"use client";

import { Check, Minus } from "lucide-react";

import { AppBadge } from "@/components/components-app/ui/badge";
import { formatValue, formatWhole, GAP } from "@/components/product/format";
import { SectionCard } from "@/components/product/section-card";
import type { AccountDetail } from "@/lib/accounts/labels";
import type { Meta } from "@/lib/bff/envelope";

const th = "py-2 pr-3 font-medium text-right";
const num = "py-2 pr-3 text-right tabular-nums whitespace-nowrap";

/** EIA-861 by year: customers, meters, sales, revenue and prices, with the early release marked. */
export function EiaCard({ account, meta, className }: { account: AccountDetail; meta: Meta; className?: string }) {
  const years = account.eia_series;
  return (
    <SectionCard title="EIA-861 series" subtitle="Meters include delivery-only customers; sales, revenue and prices are bundled only." meta={meta} className={className}>
      {years.length === 0 ? (
        <p className="text-sm text-muted-foreground">No EIA-861 filing matched to this account.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="text-muted-foreground">
              <tr className="border-b border-border">
                <th className="py-2 pr-3 text-left font-medium">Year</th>
                <th className="py-2 pr-3 text-left font-medium">Form</th>
                <th className={th}>Customers</th>
                <th className={th}>Delivery-only</th>
                <th className={th}>Meters</th>
                <th className={th}>Sales</th>
                <th className={th}>Revenue</th>
                <th className={th}>Avg price</th>
                <th className={th}>Residential</th>
              </tr>
            </thead>
            <tbody>
              {years.map((y) => (
                <tr key={`${y.data_year}-${y.early_release}`} className="border-b border-border last:border-0">
                  <td className="py-2 pr-3 whitespace-nowrap tabular-nums">
                    {y.data_year}
                    {y.early_release && (
                      <AppBadge state="alert" className="ml-1.5">
                        Early release
                      </AppBadge>
                    )}
                  </td>
                  <td className="py-2 pr-3">{y.form ?? GAP}</td>
                  <td className={num}>{formatWhole(y.customers)}</td>
                  <td className={num}>{formatWhole(y.delivery_customers)}</td>
                  <td className={num}>{formatWhole(y.meters)}</td>
                  <td className={num}>{formatValue(y.sales_mwh, "MWh")}</td>
                  <td className={num}>{formatValue(y.revenue_kusd, "thousand USD")}</td>
                  <td className={num}>{formatValue(y.price_usd_kwh, "USD/kWh")}</td>
                  <td className={num}>{formatValue(y.res_price_usd_kwh, "USD/kWh")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </SectionCard>
  );
}

function Covered({ on, label, off }: { on: boolean; label: string; off: string }) {
  return (
    <li className="flex items-center gap-2 text-sm">
      {on ? <Check className="size-4 text-basecast-brand" aria-hidden /> : <Minus className="size-4 text-muted-foreground" aria-hidden />}
      <span>{label}</span>
      {!on && <span className="text-xs text-muted-foreground">{off}</span>}
    </li>
  );
}

/** What the diagnosis could not fill (`gaps`) and which data it stands on (`coverage`). */
export function GapsCard({ account, meta, className }: { account: AccountDetail; meta: Meta; className?: string }) {
  const gaps = account.gaps ?? [];
  const coverage = account.coverage;
  return (
    <SectionCard title="Data gaps and coverage" meta={meta} className={className}>
      <div className="space-y-4">
        {gaps.length ? (
          <ul className="space-y-2">
            {gaps.map((gap) => (
              <li key={`${gap.key}-${gap.kind}`} className="flex items-start gap-2 text-sm">
                <AppBadge state={gap.kind === "missing" ? "alert" : "meta"} className="mt-0.5 shrink-0">
                  {gap.kind.replaceAll("_", " ")}
                </AppBadge>
                <span>{gap.detail}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">No gap reported.</p>
        )}
        {coverage && (
          <div>
            <p className="mb-1.5 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
              Coverage · resolution {coverage.resolution}
            </p>
            <ul className="space-y-1">
              <Covered on={coverage.public_data ?? true} label="Public data" off="" />
              <Covered on={coverage.utility_private_data ?? false} label="The co-op's own data" off="UtilityDataSource, not connected" />
              <Covered on={coverage.fleet_data ?? false} label="Base's fleet" off="FleetDataSource, not connected" />
            </ul>
          </div>
        )}
      </div>
    </SectionCard>
  );
}
