"use client";

import Link from "next/link";

import { AppBadge } from "@/components/components-app/ui/badge";
import { FactGrid } from "@/components/product/fact-grid";
import { formatDate, formatHour, formatNumber, formatPercent, formatPower, formatWhole, GAP } from "@/components/product/format";
import { SectionCard } from "@/components/product/section-card";
import type { AccountDetail } from "@/lib/accounts/labels";
import type { Caveat, Meta } from "@/lib/bff/envelope";

function Heading({ children }: { children: React.ReactNode }) {
  return <h3 className="mb-2 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">{children}</h3>;
}

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

function ZoneOutlook({ outlook }: { outlook: NonNullable<AccountDetail["territory"]["zone_outlook"]> }) {
  const fields: [string, string][] = [
    ["Zone", outlook.zone],
    ["LTLF summer peak, this year", formatPower(outlook.ltlf_now)],
    [
      `Actual summer peak so far${outlook.ncp_now_months ? ` (${outlook.ncp_now_months} months)` : ""}`,
      formatPower(outlook.ncp_now_mw),
    ],
    ["Actual vs LTLF", formatPercent(outlook.now_vs_ltlf, { ratio: true, signed: true })],
    ["LTLF trend", outlook.ltlf_cagr == null ? GAP : `${formatPercent(outlook.ltlf_cagr, { ratio: true, signed: true })}/yr`],
    [`4CP intensity${outlook.cp_year ? ` (${outlook.cp_year})` : ""}`, outlook.intensity == null ? GAP : outlook.intensity.toFixed(2)],
    [
      `Own peak ends${outlook.hour_years ? ` (${outlook.hour_years} mean)` : ""}`,
      `${formatHour(outlook.ncp_end_hour)}${outlook.peak_mismatch ? ` · ${outlook.peak_mismatch} vs the 4CP` : ""}`,
    ],
  ];
  return (
    <div className="space-y-3">
      <dl className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-4">
        {fields.map(([label, value]) => (
          <div key={label}>
            <dt className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">{label}</dt>
            <dd className="mt-0.5 text-sm font-medium tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>
      {outlook.line && <p className="text-sm text-foreground/80">{outlook.line}</p>}
    </div>
  );
}

/** The territory: facts, counties (exposed or the home county), data centers, the generation queue and the zone. */
export function TerritoryCard({
  account,
  meta,
  caveats,
  className,
}: {
  account: AccountDetail;
  meta: Meta;
  caveats?: Caveat[];
  className?: string;
}) {
  const t = account.territory;
  return (
    <SectionCard
      title="Territory"
      subtitle={t.context_label ?? (t.context_rule === "home_county" ? "Context: home county" : undefined)}
      caveats={caveats}
      meta={meta}
      className={className}
    >
      <div className="space-y-6">
        <FactGrid facts={t.facts} />
        <div className="grid gap-6 xl:grid-cols-2">
          <section>
            <Heading>Counties</Heading>
            <Counties counties={t.counties} />
          </section>
          <section>
            <Heading>Generation queue, raw × adjusted</Heading>
            {t.queue.length ? <Queue rows={t.queue} /> : <p className="text-sm text-muted-foreground">No project in the queue.</p>}
          </section>
        </div>
        <div className="grid gap-6 xl:grid-cols-2">
          <section>
            <Heading>New data centers nearby</Heading>
            <DataCenters sites={t.data_centers} />
          </section>
          {t.zone_outlook && (
            <section>
              <Heading>Zone outlook</Heading>
              <ZoneOutlook outlook={t.zone_outlook} />
            </section>
          )}
        </div>
      </div>
    </SectionCard>
  );
}
