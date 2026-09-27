"use client";

import { Building2, CalendarClock, Clock, Receipt, Zap } from "lucide-react";
import { Bar, BarChart, CartesianGrid, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { AppBadge } from "@/components/components-app/ui/badge";
import EmptyState from "@/components/empty-state";
import { SimulatedBadge, VerifiedBadge } from "@/components/product/caveat-badges";
import { ChartTooltipCard } from "@/components/product/chart-tooltip";
import { DashboardStatCard } from "@/components/product/dashboard-stat-card";
import { FactValue } from "@/components/product/fact-value";
import { formatDate, formatPercent, formatPower, formatWhole, GAP } from "@/components/product/format";
import { SectionCard } from "@/components/product/section-card";
import { Tooltip as HoverTip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { components } from "@/lib/api/get-data";
import { type ChartMode, gwTick, INK, SERIES } from "@/lib/charts/palette";
import { useTheme } from "@/lib/hooks/use-theme";

type Supplier = components["schemas"]["SupplierCard"];
type FourCp = components["schemas"]["FourCpOffer"];

const usdPerMwYr = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

/** The supplier's requested large load by year: one series, so no legend; each bar carries its value. */
function RequestChart({ path, mode }: { path: Supplier["path"]; mode: ChartMode }) {
  const ink = INK[mode];
  const color = SERIES[mode][0];
  return (
    <div className="h-56 w-full">
      <ResponsiveContainer>
        <BarChart data={path} margin={{ top: 20, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid vertical={false} stroke={ink.grid} />
          <XAxis dataKey="year" tickLine={false} axisLine={{ stroke: ink.axis }} tick={{ fill: ink.muted, fontSize: 12 }} />
          <YAxis tickFormatter={gwTick} tickLine={false} axisLine={false} width={60} tick={{ fill: ink.muted, fontSize: 12 }} />
          <Tooltip
            cursor={{ fill: ink.grid, opacity: 0.4 }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const point = payload[0].payload as Supplier["path"][number];
              return <ChartTooltipCard title={`In service by ${point.year}`} rows={[{ label: "Requested", value: formatPower(point.mw), color }]} />;
            }}
          />
          <Bar dataKey="mw" fill={color} radius={[4, 4, 0, 0]} maxBarSize={56} isAnimationActive={false}>
            <LabelList
              dataKey="mw"
              content={({ x, y, width, value }) => (
                <text
                  x={Number(x) + Number(width) / 2}
                  y={Number(y) - 6}
                  textAnchor="middle"
                  fill={ink.secondary}
                  fontSize={11}
                  className="tabular-nums"
                >
                  {formatPower(Number(value))}
                </text>
              )}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/**
 * The large loads the account's wholesale supplier asked for (requests, not forecasts): the API's sentence about
 * them in the title's tooltip, the chart beside the badges and the filing.
 */
function SupplierCard({ supplier, mode }: { supplier: Supplier; mode: ChartMode }) {
  return (
    <SectionCard
      title={`Wholesale supplier · ${supplier.gt}`}
      icon={Building2}
      subtitle={supplier.via === "self" ? "Self-filed" : `Via ${supplier.tsp ?? supplier.gt}`}
      info={supplier.fact || undefined}
      action={<VerifiedBadge verified={supplier.verified} />}
    >
      <div className="grid gap-6 lg:grid-cols-5">
        <div className="space-y-4 lg:col-span-2">
          <div className="flex flex-wrap gap-1.5">
            {supplier.share_of_rfi != null && (
              <AppBadge state="meta">{formatPercent(supplier.share_of_rfi, { ratio: true })} of the ERCOT RFI</AppBadge>
            )}
            {supplier.n_accounts != null && <AppBadge state="meta">{formatWhole(supplier.n_accounts)} accounts</AppBadge>}
            {supplier.fires_trigger && <AppBadge state="info">Context trigger</AppBadge>}
          </div>
          <p className="text-xs text-muted-foreground">
            Filed {formatDate(supplier.filed_date)}
            {supplier.source_ref && <span className="font-mono"> · {supplier.source_ref}</span>}
          </p>
        </div>
        <div className="min-w-0 lg:col-span-3">
          <p className="mb-1 text-xs font-medium text-muted-foreground">Requested MW by year</p>
          <RequestChart path={supplier.path} mode={mode} />
        </div>
      </div>
    </SectionCard>
  );
}

/**
 * The account's own load at the 4CP: private data, so a gap with "Not connected" (the API's note in its tooltip)
 * until the account's data is connected; then the value as any Fact.
 */
function Account4cp({ fact }: { fact: FourCp["account_4cp"] }) {
  if (fact.value !== null && fact.value !== undefined) {
    return <FactValue fact={fact} valueClassName="text-2xl font-semibold text-foreground" />;
  }
  const badge = <AppBadge state="meta">Not connected</AppBadge>;
  return (
    <span className="flex items-center gap-2">
      <span className="text-2xl font-semibold text-muted-foreground tabular-nums">{GAP}</span>
      {fact.note ? (
        <HoverTip>
          <TooltipTrigger asChild>
            <span tabIndex={0} className="cursor-help">
              {badge}
            </span>
          </TooltipTrigger>
          <TooltipContent className="max-w-xs text-xs">{fact.note}</TooltipContent>
        </HoverTip>
      ) : (
        badge
      )}
      <SimulatedBadge simulated={fact.simulated ?? false} />
      <VerifiedBadge verified={fact.verified} />
    </span>
  );
}

/** The 4CP offer in numbers (each transmission rate, the window, the dispatch days), then the account and the zone. */
function FourCpSection({ offer }: { offer: FourCp }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {offer.rates.map((rate) => (
          <DashboardStatCard
            key={`${rate.charges_for_year}-${rate.docket}`}
            layout="stacked"
            icon={<Receipt className="size-4" aria-hidden />}
            title={`Transmission rate ${rate.charges_for_year}`}
            value={`${usdPerMwYr.format(rate.usd_per_mw_yr)}/MW-yr`}
            hint={`${rate.status === "final" ? "Final" : "Pending"} · billed ${rate.billed_year} · docket ${rate.docket}`}
            isAlert={rate.status !== "final"}
          />
        ))}
        <DashboardStatCard
          layout="stacked"
          icon={<Clock className="size-4" aria-hidden />}
          title="Discharge window"
          value={`${offer.window_start_local}–${offer.window_end_local}`}
          hint={`Local time · zone ${offer.zone}`}
        />
        {offer.dispatch_days != null && (
          <DashboardStatCard
            layout="stacked"
            icon={<CalendarClock className="size-4" aria-hidden />}
            title="Dispatch days"
            value={`~${formatWhole(offer.dispatch_days)}`}
            hint="per summer"
          />
        )}
      </div>
      <SectionCard title="4CP offer" icon={Zap} info={offer.note || undefined} action={<VerifiedBadge verified={offer.verified} />}>
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground">{offer.account_4cp.label}</p>
            <Account4cp fact={offer.account_4cp} />
          </div>
          {offer.zone_line && <p className="rounded-md bg-muted/60 px-3 py-2 text-sm text-foreground/80">{offer.zone_line}</p>}
        </div>
      </SectionCard>
    </div>
  );
}

/** Wholesale & 4CP: the supplier's large-load requests and the 4CP offer, when the diagnosis has them. */
export function MarketTab({ account }: { account: components["schemas"]["AccountDetail"] }) {
  const { resolvedTheme } = useTheme();
  const mode: ChartMode = resolvedTheme === "dark" ? "dark" : "light";
  const suppliers = account.suppliers ?? [];
  if (!suppliers.length && !account.four_cp_offer) {
    return (
<EmptyState compact Icon={Building2} title="No wholesale supplier or 4CP offer" />
    );
  }
  return (
    <div className="space-y-4">
      {suppliers.map((supplier) => (
        <SupplierCard key={`${supplier.gt}-${supplier.tsp ?? ""}`} supplier={supplier} mode={mode} />
      ))}
      {account.four_cp_offer && <FourCpSection offer={account.four_cp_offer} />}
    </div>
  );
}
