"use client";

import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { AppBadge } from "@/components/components-app/ui/badge";
import { ChartTooltipCard } from "@/components/product/chart-tooltip";
import { DataCard } from "@/components/product/data-card";
import { formatPercent, formatWhole, GAP } from "@/components/product/format";
import { SectionCard } from "@/components/product/section-card";
import { Skeleton } from "@/components/ui/skeleton";
import type { components } from "@/lib/api/get-data";
import { useProductQuery } from "@/lib/bff/queries";
import { type ChartMode, INK, SERIES } from "@/lib/charts/palette";
import { useTheme } from "@/lib/hooks/use-theme";
import { cn } from "@/lib/utils";

type FourCp = components["schemas"]["FourCpData"];
type Meta = components["schemas"]["Meta"];

const MONTHS = ["Jun", "Jul", "Aug", "Sep"];
const minutes = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
};
/** Whether an interval ending at `local` ("2012-06-05 17:00") falls inside the offer's window (end-exclusive start). */
const inWindow = (local: string, start: string, end: string) => {
  const t = minutes(local.slice(11, 16));
  return t > minutes(start) && t <= minutes(end);
};

/** Every summer's four coincident-peak intervals, by month, marked inside or outside the offer's window. */
function Calendar({ data, meta }: { data: FourCp; meta: Meta }) {
  const years = [...new Set(data.intervals.map((i) => i.year))].sort((a, b) => b - a);
  const start = data.window_start_local;
  const end = data.window_end_local;
  const covered = start && end ? data.intervals.filter((i) => inWindow(i.interval_end_local, start, end)).length : null;
  return (
    <SectionCard
      title="The 4CP intervals"
      subtitle={
        start && end
          ? `ERCOT's four coincident peaks each summer. ${covered} of ${data.intervals.length} fall inside the ${start}–${end} window.`
          : "ERCOT's four coincident peaks each summer."
      }
      meta={meta}
    >
      <div className="overflow-x-auto">
        <table className="w-full text-xs whitespace-nowrap">
          <thead className="text-muted-foreground">
            <tr className="border-b border-border">
              <th className="py-1.5 pr-3 text-left font-medium">Summer</th>
              {MONTHS.map((m) => (
                <th key={m} className="py-1.5 pr-3 text-left font-medium">
                  {m}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {years.map((year) => (
              <tr key={year} className="border-b border-border last:border-0">
                <td className="py-1.5 pr-3 tabular-nums">{year}</td>
                {[6, 7, 8, 9].map((month) => {
                  const interval = data.intervals.find((i) => i.year === year && i.month === month);
                  if (!interval) return <td key={month} className="py-1.5 pr-3 text-muted-foreground">{GAP}</td>;
                  const inside = start && end ? inWindow(interval.interval_end_local, start, end) : null;
                  return (
                    <td key={month} className="py-1.5 pr-3">
                      <span
                        className={cn(
                          "rounded px-1.5 py-0.5 tabular-nums",
                          inside === true && "bg-basecast-brand/15 text-foreground",
                          inside === false && "text-muted-foreground",
                        )}
                        title={`${interval.interval_end_local} · ${formatWhole(interval.mw)} MW${interval.final ? "" : " · not final"}`}
                      >
                        {interval.interval_end_local.slice(5, 16)}
                        {!interval.final && "*"}
                      </span>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">Interval end, local time. Shaded: inside the window. * not final.</p>
    </SectionCard>
  );
}

/** How many dispatch days a summer takes against how often they catch the 4CPs (X3). */
function DispatchCurve({ data, meta, mode }: { data: FourCp; meta: Meta; mode: ChartMode }) {
  const ink = INK[mode];
  const [allColor, monthColor, dayColor] = SERIES[mode];
  const points = [...data.dispatch_curve].sort((a, b) => a.dispatch_days - b.dispatch_days);
  return (
    <SectionCard
      title="Dispatch days against hit rate"
      subtitle="A weather rule that dispatches on more days catches more coincident peaks."
      caveats={meta.caveats?.filter((c) => c.code === "optimistic_weather")}
      meta={meta}
    >
      <div className="h-64 w-full">
        <ResponsiveContainer>
          <LineChart data={points} margin={{ top: 8, right: 16, bottom: 12, left: 8 }}>
            <CartesianGrid vertical={false} stroke={ink.grid} />
            <XAxis
              dataKey="dispatch_days"
              type="number"
              domain={["dataMin", "dataMax"]}
              tickLine={false}
              axisLine={{ stroke: ink.axis }}
              tick={{ fill: ink.muted, fontSize: 12 }}
              label={{ value: "Dispatch days per summer", position: "insideBottom", offset: -8, fill: ink.muted, fontSize: 11 }}
            />
            <YAxis domain={[0, 1]} tickFormatter={(v: number) => `${Math.round(v * 100)}%`} tickLine={false} axisLine={false} width={44} tick={{ fill: ink.muted, fontSize: 12 }} />
            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const p = payload[0].payload as FourCp["dispatch_curve"][number];
                return (
                  <ChartTooltipCard
                    title={`${formatWhole(p.dispatch_days)} dispatch days`}
                    rows={[
                      { label: "All four CPs caught", value: formatPercent(p.all4_rate, { ratio: true }), color: allColor },
                      { label: "CP months caught", value: formatPercent(p.month_rate, { ratio: true }), color: monthColor },
                      { label: "CP days caught", value: formatPercent(p.day_rate, { ratio: true }), color: dayColor },
                    ]}
                  />
                );
              }}
            />
            <Line dataKey="all4_rate" stroke={allColor} strokeWidth={2} dot={{ r: 3 }} isAnimationActive={false} />
            <Line dataKey="month_rate" stroke={monthColor} strokeWidth={2} dot={{ r: 3 }} isAnimationActive={false} />
            <Line dataKey="day_rate" stroke={dayColor} strokeWidth={2} dot={{ r: 3 }} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="h-0.5 w-4" style={{ background: allColor }} /> All four caught
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-0.5 w-4" style={{ background: monthColor }} /> Months caught
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-0.5 w-4" style={{ background: dayColor }} /> Days caught
        </span>
      </div>
    </SectionCard>
  );
}

/** Where scarcity went: the hour the load peaks against the hour the net load (after wind and solar) peaks. */
function Scarcity({ data, meta, mode }: { data: FourCp; meta: Meta; mode: ChartMode }) {
  const ink = INK[mode];
  const [loadColor, netColor] = SERIES[mode];
  return (
    <SectionCard title="The peak hour moved" subtitle="Mean hour ending of the summer load peak and of the net-load peak (load minus wind and solar)." meta={meta}>
      <div className="h-64 w-full">
        <ResponsiveContainer>
          <LineChart data={data.scarcity} margin={{ top: 8, right: 16, bottom: 0, left: 8 }}>
            <CartesianGrid vertical={false} stroke={ink.grid} />
            <XAxis dataKey="year" tickLine={false} axisLine={{ stroke: ink.axis }} tick={{ fill: ink.muted, fontSize: 12 }} />
            <YAxis domain={["auto", "auto"]} tickFormatter={(v: number) => `HE ${v}`} tickLine={false} axisLine={false} width={48} tick={{ fill: ink.muted, fontSize: 12 }} />
            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const s = payload[0].payload as FourCp["scarcity"][number];
                return (
                  <ChartTooltipCard
                    title={`Summer ${s.year}`}
                    rows={[
                      { label: "Load peak, mean HE", value: s.load_peak_mean_he == null ? GAP : s.load_peak_mean_he.toFixed(1), color: loadColor },
                      { label: "Net-load peak, mean HE", value: s.net_load_peak_mean_he == null ? GAP : s.net_load_peak_mean_he.toFixed(1), color: netColor },
                      { label: "Wind and solar share", value: formatPercent(s.wind_solar_share, { ratio: true }) },
                    ]}
                  />
                );
              }}
            />
            <Line dataKey="load_peak_mean_he" stroke={loadColor} strokeWidth={2} dot={{ r: 3 }} isAnimationActive={false} />
            <Line dataKey="net_load_peak_mean_he" stroke={netColor} strokeWidth={2} dot={{ r: 3 }} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="h-0.5 w-4" style={{ background: loadColor }} /> Load peak
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-0.5 w-4" style={{ background: netColor }} /> Net-load peak
        </span>
      </div>
    </SectionCard>
  );
}

const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 3 });

/** The transmission rate a 4CP reduction avoids, by year, with its docket and whether it is final. */
function Rates({ data, meta }: { data: FourCp; meta: Meta }) {
  return (
    <SectionCard title="Transmission rates" subtitle="The postage-stamp rate a co-op pays on its 4CP load: what a 4CP reduction avoids." meta={meta}>
      <table className="w-full text-xs whitespace-nowrap">
        <thead className="text-left text-muted-foreground">
          <tr className="border-b border-border">
            <th className="py-1.5 pr-3 font-medium">Charges for</th>
            <th className="py-1.5 pr-3 text-right font-medium">Per kW-year</th>
            <th className="py-1.5 pr-3 font-medium">Status</th>
            <th className="py-1.5 pr-3 font-medium">Billed</th>
            <th className="py-1.5 font-medium">Docket</th>
          </tr>
        </thead>
        <tbody>
          {data.rates.map((rate) => (
            <tr key={`${rate.charges_for_year}-${rate.docket}`} className="border-b border-border last:border-0">
              <td className="py-1.5 pr-3 tabular-nums">{rate.charges_for_year}</td>
              <td className="py-1.5 pr-3 text-right font-medium tabular-nums">{usd.format(rate.postage_stamp_usd_per_kw_yr)}</td>
              <td className="py-1.5 pr-3">
                <AppBadge state={rate.status === "final" ? "active" : "alert"}>{rate.status}</AppBadge>
              </td>
              <td className="py-1.5 pr-3 tabular-nums">{rate.billed_year}</td>
              <td className="py-1.5 font-mono">
                {rate.source_url ? (
                  <a href={rate.source_url} target="_blank" rel="noreferrer" className="underline hover:text-foreground">
                    {rate.docket}
                  </a>
                ) : (
                  rate.docket
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </SectionCard>
  );
}

/** The 4CP tab (X3): the intervals and the window, the dispatch curve, where scarcity moved and the rates. */
export function FourCpTab() {
  const { resolvedTheme } = useTheme();
  const mode: ChartMode = resolvedTheme === "dark" ? "dark" : "light";
  const query = useProductQuery<FourCp>("four-cp");
  const envelope = query.data;
  return (
    <div className="space-y-4">
      <DataCard<FourCp>
        title="4CP: the four coincident peaks"
        subtitle="Transmission costs follow each summer's four coincident peaks; a battery that discharges through them avoids that cost."
        query={query}
        isEmpty={(d) => d.intervals.length === 0}
        skeleton={<Skeleton className="h-24 w-full" />}
      >
        {(d) =>
          d.window_start_local && d.window_end_local ? (
            <p className="text-sm">
              Offer window <span className="font-semibold tabular-nums">{d.window_start_local}–{d.window_end_local}</span> local time.
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">The offer window is not set.</p>
          )
        }
      </DataCard>
      {envelope && envelope.data.intervals.length > 0 && (
        <>
          <div className="grid gap-4 xl:grid-cols-2">
            <Calendar data={envelope.data} meta={envelope.meta} />
            <DispatchCurve data={envelope.data} meta={envelope.meta} mode={mode} />
          </div>
          <div className="grid gap-4 xl:grid-cols-2">
            <Scarcity data={envelope.data} meta={envelope.meta} mode={mode} />
            <Rates data={envelope.data} meta={envelope.meta} />
          </div>
        </>
      )}
    </div>
  );
}
