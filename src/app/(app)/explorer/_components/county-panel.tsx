"use client";

import { ArrowRight, Factory, Landmark, ListOrdered, type LucideIcon, Server, Target, Trophy, Users, X, Zap } from "lucide-react";
import Link from "next/link";

import { AppBadge } from "@/components/components-app/ui/badge";
import { MartNotBuiltState } from "@/components/product/data-card";
import { formatDate, formatPercent, formatPower, formatWhole, GAP } from "@/components/product/format";
import { KpiItem } from "@/components/product/kpi-item";
import { SectionCard } from "@/components/product/section-card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { components } from "@/lib/api/get-data";
import { isMartNotBuilt } from "@/lib/bff/envelope";
import { useProductQuery } from "@/lib/bff/queries";
import { CHANNEL_HUE, type Mode, NO_DATA } from "@/lib/explorer/colors";
import { CHANNEL_LABEL } from "@/lib/explorer/layers";

import { NextActionBadge } from "../../accounts/_components/account-bits";

type CountyDetail = components["schemas"]["CountyDetail"];

export const STRATUM_LABEL: Record<string, string> = {
  all: "All fuels",
  solar: "Solar",
  storage: "Storage",
  wind: "Wind",
  gas_other: "Gas & other",
};

/** A part of the panel, as Fundsys's detail sections: the icon in a brand-tinted square, the title, a link aside. */
function PanelSection({
  icon: Icon,
  title,
  aside,
  children,
}: {
  icon: LucideIcon;
  title: string;
  aside?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="border-t border-border pt-5">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className="shrink-0 rounded-md bg-basecast-brand-surface p-1.5">
            <Icon className="size-3.5 text-basecast-brand" aria-hidden />
          </span>
          <h3 className="text-sm font-semibold">{title}</h3>
        </div>
        {aside}
      </div>
      {children}
    </section>
  );
}

/** The county's land by channel, as shares of its area. */
function ChannelShares({ a, mode }: { a: NonNullable<CountyDetail["acquisition"]>; mode: Mode }) {
  const parts = [
    { label: "Retail (IOU areas)", share: a.retail_share, color: CHANNEL_HUE.retail_direct[mode] },
    { label: "Co-ops", share: a.coop_share, color: CHANNEL_HUE.partnership[mode] },
    { label: "Munis", share: a.muni_share, color: CHANNEL_HUE.mixed[mode] },
    { label: "Outside", share: a.outside_share, color: NO_DATA[mode] },
  ];
  return (
    <div className="space-y-2">
      <div className="flex h-2.5 overflow-hidden rounded-full bg-muted" aria-hidden>
        {parts.map((p) => (
          <span key={p.label} className="h-full border-r-2 border-card last:border-r-0" style={{ width: `${p.share * 100}%`, background: p.color }} />
        ))}
      </div>
      <ul className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
        {parts.map((p) => (
          <li key={p.label} className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-[2px]" style={{ background: p.color }} />
            <span className="text-muted-foreground">{p.label}</span>
            <span className="ml-auto tabular-nums">{formatPercent(p.share, { ratio: true })}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * The clicked county: its priority as "market × grid", drivers and drags, the channels by area, the
 * generation queue by stratum and its largest projects, new data centers, and the co-ops and munis that
 * cover it, with a link to them in /accounts.
 */
export function CountyPanel({ fips, mode, onClose }: { fips: string; mode: Mode; onClose: () => void }) {
  const query = useProductQuery<CountyDetail>(`geo/counties/${fips}`, undefined, { throwOnError: false });
  const detail = query.data?.data;
  const meta = query.data?.meta;
  const signal = (code: string) => detail?.signals.find((s) => s.signal === code)?.label ?? code;

  const close = (
    <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={onClose} aria-label="Close the county">
      <X />
    </Button>
  );

  if (!detail || !meta) {
    return (
      <SectionCard title={`County ${fips}`} action={close}>
        {isMartNotBuilt(query.error) ? (
          <MartNotBuiltState mart={query.error.mart} />
        ) : query.error ? (
          <p className="text-sm text-muted-foreground">This county could not load: {query.error.message}.</p>
        ) : (
          <Skeleton className="h-96 w-full" />
        )}
      </SectionCard>
    );
  }

  const a = detail.acquisition;
  const all = detail.queue.find((q) => q.stratum === "all");
  return (
    <SectionCard
      title={
        <span className="text-lg">
          {detail.county_name} County <span className="font-mono text-xs font-normal text-muted-foreground">{detail.county_fips}</span>
        </span>
      }
      subtitle={detail.in_ercot ? `Weather zone ${detail.weather_zone ?? GAP}` : "Outside ERCOT"}
      action={close}
      caveats={meta.caveats?.filter((c) => ["by_area_not_homes", "by_county_not_point", "fixture", "simulated"].includes(c.code))}
      meta={meta}
    >
      <div className="space-y-5">
        {a && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-x-4 gap-y-3">
              <KpiItem icon={Target} label="Acquisition priority" value={a.priority.toFixed(2)} />
              <KpiItem icon={Trophy} label="Rank" value={`#${a.rank} · class ${a.priority_class} of 5`} />
              <KpiItem icon={Users} label="Market score" value={a.market_score.toFixed(2)} />
              <KpiItem icon={Zap} label="Grid factor" value={`× ${a.grid_factor.toFixed(2)}`} />
            </div>
            <p className="flex flex-wrap items-center gap-1.5">
              <AppBadge state="meta">{CHANNEL_LABEL[a.channel]}</AppBadge>
              {a.retail_rank != null && <AppBadge state="meta">Retail list #{a.retail_rank}</AppBadge>}
              {a.partner_rank != null && <AppBadge state="meta">Partnership list #{a.partner_rank}</AppBadge>}
            </p>
          </div>
        )}

        {a && (
          <PanelSection icon={Target} title="Why it ranks here">
            <div className="space-y-4">
              {(a.drivers.length > 0 || a.drags.length > 0) && (
                <div className="space-y-2 text-xs">
                  {a.drivers.length > 0 && (
                    <div className="space-y-1.5">
                      <p className="font-medium text-muted-foreground">Drivers</p>
                      <p className="flex flex-wrap gap-1.5">
                        {a.drivers.map((d) => (
                          <AppBadge key={d} state="active" className="h-auto max-w-full py-0.5 text-left whitespace-normal">
                            {signal(d)}
                          </AppBadge>
                        ))}
                      </p>
                    </div>
                  )}
                  {a.drags.length > 0 && (
                    <div className="space-y-1.5">
                      <p className="font-medium text-muted-foreground">Drags</p>
                      <p className="flex flex-wrap gap-1.5">
                        {a.drags.map((d) => (
                          <AppBadge key={d} state="alert" className="h-auto max-w-full py-0.5 text-left whitespace-normal">
                            {signal(d)}
                          </AppBadge>
                        ))}
                      </p>
                    </div>
                  )}
                </div>
              )}
              <div>
                <p className="mb-1.5 text-xs font-medium text-muted-foreground">Channels, by area</p>
                <ChannelShares a={a} mode={mode} />
              </div>
            </div>
          </PanelSection>
        )}

        <PanelSection icon={Factory} title={`Generation queue${detail.queue_as_of_month ? ` · ${formatDate(detail.queue_as_of_month)}` : ""}`}>
          {detail.queue.length === 0 ? (
            <p className="text-sm text-muted-foreground">No active project in the generation queue.</p>
          ) : (
            <table className="w-full text-xs">
              <thead className="text-muted-foreground">
                <tr className="border-b border-border">
                  <th className="py-1.5 pr-2 text-left font-medium">Stratum</th>
                  <th className="py-1.5 pr-2 text-right font-medium">Raw</th>
                  <th className="py-1.5 pr-2 text-right font-medium">Adj. Dec 2027</th>
                  <th className="py-1.5 text-right font-medium">Adj. Dec 2028</th>
                </tr>
              </thead>
              <tbody>
                {detail.queue.map((q) => (
                  <tr key={q.stratum} className="border-b border-border last:border-0">
                    <td className="py-1.5 pr-2">
                      {STRATUM_LABEL[q.stratum] ?? q.stratum}
                      <span className="text-muted-foreground"> · {q.projects}</span>
                    </td>
                    <td className="py-1.5 pr-2 text-right tabular-nums">{formatPower(q.raw_mw)}</td>
                    <td className="py-1.5 pr-2 text-right tabular-nums">{formatPower(q.adj_mw_2027)}</td>
                    <td className="py-1.5 text-right tabular-nums">{formatPower(q.adj_mw_2028)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {all?.large_gas_mw_2028 ? (
            <p className="mt-2">
              <AppBadge state="alert">Large new gas: {formatPower(all.large_gas_mw_2028)} by Dec 2028</AppBadge>
            </p>
          ) : null}
        </PanelSection>

        {detail.top_projects.length > 0 && (
          <PanelSection icon={ListOrdered} title="Largest projects by expected MW, Dec 2028">
            <ul className="space-y-2">
              {detail.top_projects.map((p) => (
                <li key={p.inr} className="text-xs">
                  <p className="flex items-baseline justify-between gap-2">
                    <span className="font-medium text-foreground">{p.project_name}</span>
                    <span className="shrink-0 tabular-nums">{formatPower(p.mw_2028)}</span>
                  </p>
                  <p className="text-muted-foreground">
                    <span className="font-mono">{p.inr}</span> · {STRATUM_LABEL[p.stratum] ?? p.stratum} · {p.stage === "ia" ? "IA signed" : "Entry"} ·{" "}
                    {formatPower(p.capacity_mw)} ·{" "}
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span tabIndex={0} className="cursor-help underline decoration-dotted underline-offset-2">
                          P(COD by Dec 2028) {formatPercent(p.p_cod_2028, { ratio: true })}
                          {p.clamped_2028 ? "*" : ""}
                        </span>
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs text-xs">
                        Survival curve: {p.curve}.{p.clamped_2028 ? " Clock clamped past the curve's support (fewer than 10 at risk)." : ""}
                      </TooltipContent>
                    </Tooltip>{" "}
                    · developer&apos;s COD {formatDate(p.projected_cod)}
                  </p>
                </li>
              ))}
            </ul>
          </PanelSection>
        )}

        <PanelSection icon={Server} title="New data centers since 2025">
          {detail.data_centers.length === 0 ? (
            <p className="text-sm text-muted-foreground">None matched in this county.</p>
          ) : (
            <ul className="space-y-1.5 text-xs">
              {detail.data_centers.map((site) => (
                <li key={site.tceq_rn}>
                  <span className="font-medium">{site.site_name}</span>
                  <span className="text-muted-foreground">
                    {site.city ? ` · ${site.city}` : ""} · first permit {formatDate(site.first_permit_date)} ·{" "}
                    <span className="font-mono">{site.tceq_rn}</span>
                  </span>
                  {site.matched_by === "naics" && (
                    <AppBadge state="meta" className="ml-1.5">
                      NAICS only
                    </AppBadge>
                  )}
                </li>
              ))}
            </ul>
          )}
        </PanelSection>

        <PanelSection
          icon={Landmark}
          title="Co-ops and munis here"
          aside={
            detail.accounts.length > 0 && (
              <Link
                href={`/accounts?county=${detail.county_fips}`}
                className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-basecast-brand hover:underline"
              >
                Accounts <ArrowRight className="size-3" aria-hidden />
              </Link>
            )
          }
        >
          {detail.accounts.length === 0 ? (
            <p className="text-sm text-muted-foreground">No co-op or muni covers this county.</p>
          ) : (
            <ul className="space-y-1.5 text-xs">
              {detail.accounts.map((acc) => (
                <li key={acc.account_id} className="flex items-center gap-2">
                  <Link href={`/accounts/${acc.account_id}`} className="min-w-0 truncate font-medium hover:text-basecast-brand hover:underline">
                    {acc.name}
                  </Link>
                  <span className="shrink-0 text-muted-foreground">
                    {formatPercent(acc.county_share, { ratio: true })} · #{formatWhole(acc.rank)}
                  </span>
                  <span className="ml-auto shrink-0">
                    <NextActionBadge action={acc.next_action} />
                  </span>
                </li>
              ))}
            </ul>
          )}
        </PanelSection>
      </div>
    </SectionCard>
  );
}
