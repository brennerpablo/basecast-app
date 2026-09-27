"use client";

import {
  ArrowRight,
  CloudSun,
  Factory,
  Gauge,
  Hammer,
  House,
  ListPlus,
  type LucideIcon,
  Map as MapIcon,
  MapPinned,
  Server,
  TrendingUp,
  Users,
} from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

import { AppBadge } from "@/components/components-app/ui/badge";
import { CountyMap } from "@/components/maps/county-map";
import { FactGrid } from "@/components/product/fact-grid";
import { FactValue } from "@/components/product/fact-value";
import { formatDate, formatNumber, formatPercent, formatPower, formatWhole, GAP } from "@/components/product/format";
import { KpiItem } from "@/components/product/kpi-item";
import { KpiStatCard, KpiStatItem } from "@/components/product/kpi-stat-card";
import { SectionCard } from "@/components/product/section-card";
import type { AccountDetail } from "@/lib/accounts/labels";
import { groupTerritoryFacts, splitLabel } from "@/lib/accounts/summary";
import type { Fact } from "@/lib/bff/envelope";
import { SERIES } from "@/lib/charts/palette";
import { type Mode, SEQUENTIAL } from "@/lib/explorer/colors";
import type { CountyStyle } from "@/lib/explorer/layers";
import { useTheme } from "@/lib/hooks/use-theme";
import { cn } from "@/lib/utils";

const th = "py-2 pr-3 font-medium";
const td = "py-2 pr-3";
const num = "py-2 pr-3 text-right tabular-nums whitespace-nowrap";

function Counties({ counties }: { counties: AccountDetail["territory"]["counties"] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead className="text-left text-muted-foreground">
          <tr className="border-b border-border">
            <th className={th}>County</th>
            <th className={`${th} text-right`}>Overlap</th>
            <th className={`${th} text-right`}>Of the county</th>
            <th className={`${th} text-right`}>Of the territory</th>
            <th className={th}>Zone</th>
            <th className={th}>Role</th>
          </tr>
        </thead>
        <tbody>
          {counties.map((c) => (
            <tr key={c.county_fips} className="border-b border-border last:border-0">
              <td className={td}>
                <Link href={`/explorer?county=${c.county_fips}`} className="hover:text-basecast-brand hover:underline">
                  {c.county_name}
                </Link>
              </td>
              <td className={num}>{formatNumber(c.overlap_km2)} km²</td>
              <td className={num}>{formatPercent(c.county_share, { ratio: true })}</td>
              <td className={num}>{formatPercent(c.territory_share, { ratio: true })}</td>
              <td className={td}>{c.weather_zone ?? GAP}</td>
              <td className={`${td} space-x-1`}>
                {c.exposed && <AppBadge state="active">Exposed</AppBadge>}
                {c.context && <AppBadge state="meta">Context</AppBadge>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Queue({ rows }: { rows: AccountDetail["territory"]["queue"] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead className="text-left text-muted-foreground">
          <tr>
            <th className={th} rowSpan={2}>
              Stratum
            </th>
            <th className={`${th} border-b border-border text-center`} colSpan={4}>
              Context counties
            </th>
            <th className={`${th} border-b border-border text-center`} colSpan={3}>
              Apportioned to the territory
            </th>
          </tr>
          <tr className="border-b border-border">
            <th className={`${th} text-right`}>Projects</th>
            <th className={`${th} text-right`}>Raw</th>
            <th className={`${th} text-right`}>Adj. Dec 2027</th>
            <th className={`${th} text-right`}>Adj. Dec 2028</th>
            <th className={`${th} text-right`}>Raw</th>
            <th className={`${th} text-right`}>Adj. Dec 2027</th>
            <th className={`${th} text-right`}>Adj. Dec 2028</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.stratum} className="border-b border-border last:border-0">
              <td className={`${td} capitalize`}>{r.stratum.replaceAll("_", " ")}</td>
              <td className={num}>{formatWhole(r.projects_context)}</td>
              <td className={num}>{formatPower(r.raw_mw_context)}</td>
              <td className={num}>{formatPower(r.adj_mw_2027_context)}</td>
              <td className={num}>{formatPower(r.adj_mw_2028_context)}</td>
              <td className={num}>{formatPower(r.raw_mw_apportioned)}</td>
              <td className={num}>{formatPower(r.adj_mw_2027_apportioned)}</td>
              <td className={num}>{formatPower(r.adj_mw_2028_apportioned)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DataCenters({ sites }: { sites: AccountDetail["territory"]["data_centers"] }) {
  if (!sites.length) return <p className="text-sm text-muted-foreground">No new data-center site in these counties.</p>;
  return (
    <ul className="space-y-2">
      {sites.map((site) => (
        <li key={site.tceq_rn} className="text-sm">
          <span className="font-medium">{site.name}</span>
          <span className="text-xs text-muted-foreground">
            {" "}
            · {site.county_name} ({formatPercent(site.county_share, { ratio: true })} of the county) · first permit{" "}
            {formatDate(site.first_permit_date)} · <span className="font-mono">{site.tceq_rn}</span>
          </span>
          {site.matched_by === "naics" && (
            <AppBadge state="meta" className="ml-1.5">
              NAICS only
            </AppBadge>
          )}
        </li>
      ))}
    </ul>
  );
}

const GROWTH_ICON: Record<string, LucideIcon> = {
  population: Users,
  pop_growth: TrendingUp,
  permits_per_1k: Hammer,
  permits_12m: Hammer,
  permits_12m_change: TrendingUp,
  owner_sf_homes: House,
  owner_sf_share: House,
  homes_per_meter: Gauge,
};

/** Facts as a row of KPI items, each value a Fact (hover for its source). */
function FactItems({ facts, className }: { facts: Fact[]; className?: string }) {
  return (
    <div className={cn("grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3", className)}>
      {facts.map((fact) => (
        <KpiItem key={fact.key} label={fact.label} value={<FactValue fact={fact} valueClassName="text-sm font-semibold text-foreground" />} />
      ))}
    </div>
  );
}

/**
 * Where the territory sits in Texas: its counties on the Explorer's map, the exposed ones in the full blue and
 * the other context counties lighter; the rest of the state as the map's no-data grey.
 */
function LocatorCard({ account, className }: { account: AccountDetail; className?: string }) {
  const { resolvedTheme } = useTheme();
  const mode: Mode = resolvedTheme === "dark" ? "dark" : "light";
  const counties = account.territory.counties;
  const [hover, setHover] = useState<string | null>(null);
  const styles = useMemo(
    () =>
      new Map<string, CountyStyle>(
        counties.map((c) => [c.county_fips, { color: c.exposed ? SERIES[mode][0] : SEQUENTIAL[mode][1], dim: false }]),
      ),
    [counties, mode],
  );
  const hovered = counties.find((c) => c.county_fips === hover);
  const lead = counties.find((c) => c.exposed) ?? counties[0];
  return (
    <SectionCard
      title="Where"
      icon={MapIcon}
      action={
        lead && (
          <Link
            href={`/explorer?county=${lead.county_fips}`}
            className="inline-flex items-center gap-1 text-xs font-medium text-basecast-brand hover:underline"
          >
            Explorer <ArrowRight className="size-3" aria-hidden />
          </Link>
        )
      }
      className={className}
    >
      <div className="relative h-72 overflow-hidden rounded-md border border-border sm:h-80">
        <CountyMap styles={styles} mode={mode} selected={null} onHover={(h) => setHover(h?.fips ?? null)} onSelect={() => {}} className="h-full" />
        {hovered && (
          <span className="pointer-events-none absolute top-2 left-2 rounded-md border border-border bg-popover px-2 py-1 text-xs shadow-sm">
            {hovered.county_name} · {formatPercent(hovered.territory_share, { ratio: true })} of the territory
          </span>
        )}
      </div>
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="size-3 rounded-[3px]" style={{ background: SERIES[mode][0] }} /> Exposed county
        </span>
        {counties.some((c) => !c.exposed) && (
          <span className="flex items-center gap-1.5">
            <span className="size-3 rounded-[3px]" style={{ background: SEQUENTIAL[mode][1] }} /> Other
          </span>
        )}
      </div>
    </SectionCard>
  );
}

/**
 * The weather zone's facts, then the year's LTLF and the months behind the actual peak as one short line. The
 * outlook's 4CP sentence lives on the Wholesale & 4CP tab; without a 4CP offer there, it waits in the title's
 * tooltip (`line`).
 */
function ZoneCard({
  facts,
  outlook,
  line,
  className,
}: {
  facts: Fact[];
  outlook: AccountDetail["territory"]["zone_outlook"];
  line?: string | null;
  className?: string;
}) {
  if (!facts.length && !outlook) return null;
  const figures = [
    outlook?.ltlf_now != null ? `LTLF ${formatPower(outlook.ltlf_now)}` : null,
    outlook?.ncp_now_months ? `${outlook.ncp_now_months} months in` : null,
  ].filter(Boolean);
  return (
    <SectionCard
      title={outlook ? `Weather zone ${outlook.zone}` : "Weather zone"}
      icon={CloudSun}
      info={line || undefined}
      subtitle={figures.length ? figures.join(" · ") : undefined}
      className={className}
    >
      {facts.length > 0 && <FactGrid facts={facts} className="xl:grid-cols-3" />}
    </SectionCard>
  );
}

/**
 * Territory: where it sits beside its counties, the growth and homes behind the score, the generation queue
 * beside the new data centers, and the weather zone.
 */
export function TerritoryTab({ account }: { account: AccountDetail }) {
  const t = account.territory;
  const groups = groupTerritoryFacts(t.facts);
  const context = t.context_label
    ? splitLabel(t.context_label)
    : t.context_rule === "home_county"
      ? { short: "Home county", detail: null }
      : null;
  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-5 lg:items-start">
        <LocatorCard account={account} className="lg:col-span-2" />
        <SectionCard
          title="Counties"
          icon={MapPinned}
          subtitle={context?.short}
          info={context?.detail ?? undefined}
          className="lg:col-span-3"
        >
          <Counties counties={t.counties} />
        </SectionCard>
      </div>
      {groups.growth.length > 0 && (
        <KpiStatCard>
          {groups.growth.map((fact) => (
            <KpiStatItem key={fact.key} icon={GROWTH_ICON[fact.key] ?? Users} label={fact.label}>
              <FactValue fact={fact} valueClassName="text-sm font-semibold text-foreground" />
            </KpiStatItem>
          ))}
        </KpiStatCard>
      )}
      <SectionCard title="Generation queue, raw × adjusted" icon={Factory}>
        <div className="grid gap-6 xl:grid-cols-3">
          {groups.queue.length > 0 && <FactItems facts={groups.queue} className="content-start sm:grid-cols-2 xl:col-span-1" />}
          <div className="min-w-0 xl:col-span-2">
            {t.queue.length ? <Queue rows={t.queue} /> : <p className="text-sm text-muted-foreground">No project in the queue.</p>}
          </div>
        </div>
      </SectionCard>
      <div className="grid gap-4 lg:grid-cols-3 lg:items-start">
        <SectionCard title="New data centers nearby" icon={Server} subtitle="TCEQ permits since 2025">
          <div className="space-y-5">
            {groups.dataCenters.length > 0 && <FactItems facts={groups.dataCenters} className="sm:grid-cols-2" />}
            <DataCenters sites={t.data_centers} />
          </div>
        </SectionCard>
        <ZoneCard
          facts={groups.zone}
          outlook={t.zone_outlook}
          line={account.four_cp_offer?.zone_line ? null : t.zone_outlook?.line}
          className="lg:col-span-2"
        />
      </div>
      {groups.other.length > 0 && (
        <SectionCard title="Other facts" icon={ListPlus}>
          <FactGrid facts={groups.other} />
        </SectionCard>
      )}
    </div>
  );
}
