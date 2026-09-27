"use client";

import { ChartColumn, Files, Info, LineChart as LineChartIcon, Percent } from "lucide-react";
import { parseAsInteger, useQueryStates } from "nuqs";
import { useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { VerifiedBadge } from "@/components/product/caveat-badges";
import { ChartTooltipCard } from "@/components/product/chart-tooltip";
import { DashboardStatCard } from "@/components/product/dashboard-stat-card";
import { QueryBody } from "@/components/product/data-card";
import { formatDate, formatPercent, formatPower, formatWhole, GAP } from "@/components/product/format";
import { Provenance } from "@/components/product/provenance";
import { SectionCard } from "@/components/product/section-card";
import { SegmentedControl } from "@/components/product/segmented-control";
import { Skeleton } from "@/components/ui/skeleton";
import type { components } from "@/lib/api/get-data";
import type { Caveat } from "@/lib/bff/envelope";
import { useProductQuery } from "@/lib/bff/queries";
import { type ChartMode, gwTick, INK, SERIES } from "@/lib/charts/palette";
import { useTheme } from "@/lib/hooks/use-theme";
import { cn } from "@/lib/utils";

type LargeLoad = components["schemas"]["LargeLoadData"];

const MONTH = new Intl.DateTimeFormat("en-US", { timeZone: "UTC", month: "short", year: "2-digit" });
const monthLabel = (iso: string) => MONTH.format(new Date(`${iso.slice(0, 10)}T00:00:00Z`));

/** Promised × approved: for one target year, what each monthly deck promised and what got approved by then. */
function Realization({ data, mode, caveats }: { data: LargeLoad; mode: ChartMode; caveats?: Caveat[] }) {
  const years = useMemo(() => [...new Set(data.realization.map((r) => r.target_year))].sort(), [data]);
  const [{ target }, setState] = useQueryStates({ target: parseAsInteger });
  const year = target && years.includes(target) ? target : years[0];
  const rows = data.realization.filter((r) => r.target_year === year);
  const ink = INK[mode];
  const [promisedColor, approvedColor] = SERIES[mode];

  return (
    <SectionCard
      title="Promised × approved, by deck"
      icon={ChartColumn}
      caveats={caveats}
      subtitle={`What each ERCOT large-load deck promised for December ${year}, and the MW approved to energize by then.`}
      action={
        years.length > 1 && (
          <SegmentedControl
            label="Target year"
            options={years.map((y) => ({ value: y, label: String(y) }))}
            value={year}
            onChange={(next) => void setState({ target: next === years[0] ? null : next })}
          />
        )
      }
    >
      <div className="h-72 w-full">
        <ResponsiveContainer>
          <BarChart data={rows} margin={{ top: 8, right: 16, bottom: 0, left: 8 }} barGap={2}>
            <CartesianGrid vertical={false} stroke={ink.grid} />
            <XAxis
              dataKey="deck_vintage"
              tickFormatter={monthLabel}
              tickLine={false}
              axisLine={{ stroke: ink.axis }}
              tick={{ fill: ink.muted, fontSize: 11 }}
            />
            <YAxis tickFormatter={gwTick} tickLine={false} axisLine={false} width={52} tick={{ fill: ink.muted, fontSize: 12 }} />
            <Tooltip
              cursor={{ fill: ink.grid, opacity: 0.4 }}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const r = payload[0].payload as LargeLoad["realization"][number];
                return (
                  <ChartTooltipCard
                    title={`Deck of ${formatDate(r.deck_vintage)} · p. ${r.page}`}
                    rows={[
                      { label: `Promised for Dec ${r.target_year}`, value: formatPower(r.promised_mw), color: promisedColor },
                      {
                        label: r.realized_partial ? `Approved so far (through ${formatDate(r.realized_month?.slice(0, 7))})` : "Approved by then",
                        value: r.realized_a2e_mw == null ? "Not known yet" : formatPower(r.realized_a2e_mw),
                        color: approvedColor,
                      },
                      { label: "Approved when the deck came out", value: formatPower(r.base_a2e_mw) },
                      { label: "Incremental ratio", value: r.incremental_a2e == null ? GAP : r.incremental_a2e.toFixed(2) },
                    ]}
                  />
                );
              }}
            />
            <Bar dataKey="promised_mw" fill={promisedColor} radius={[4, 4, 0, 0]} isAnimationActive={false} />
            <Bar dataKey="realized_a2e_mw" fill={approvedColor} radius={[4, 4, 0, 0]} isAnimationActive={false}>
              {rows.map((r) => (
                <Cell key={r.deck_vintage} fillOpacity={r.realized_partial ? 0.45 : 1} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="size-3 rounded-[3px]" style={{ background: promisedColor }} /> Promised by the deck
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-3 rounded-[3px]" style={{ background: approvedColor }} /> Approved to energize by December
        </span>
        {rows.some((r) => r.realized_partial) && (
          <span className="flex items-center gap-1.5">
            <span className="size-3 rounded-[3px]" style={{ background: approvedColor, opacity: 0.45 }} /> Year still open: approved so far
          </span>
        )}
        {rows.some((r) => r.realized_a2e_mw == null) && <span>No orange bar: not known yet.</span>}
        <VerifiedBadge verified={rows.every((r) => r.verified !== false)} />
      </div>
    </SectionCard>
  );
}

/** The decks read and the realization ratio band the forecast uses, as stat cards, with the API's definition below. */
function LargeLoadStats({ data }: { data: LargeLoad }) {
  const decks = data.deck_vintages ?? [];
  const band = data.ratio_band;
  const ratio = (v: number | null | undefined) => (v == null ? GAP : formatPercent(v, { ratio: true }));
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <DashboardStatCard
          layout="stacked"
          icon={<Files className="size-4" aria-hidden />}
          title="Decks read"
          value={formatWhole(decks.length)}
          hint={decks.length ? `${formatDate(decks[0])} – ${formatDate(decks.at(-1))}` : undefined}
        />
        <DashboardStatCard layout="stacked" icon={<Percent className="size-4" aria-hidden />} title="Realization ratio, P10" value={ratio(band?.p10)} />
        <DashboardStatCard
          layout="stacked"
          icon={<Percent className="size-4" aria-hidden />}
          title="Realization ratio, P50"
          value={ratio(band?.p50)}
          hint={band ? `Deck of ${formatDate(band.deck_vintage)}` : undefined}
        />
        <DashboardStatCard layout="stacked" icon={<Percent className="size-4" aria-hidden />} title="Realization ratio, P90" value={ratio(band?.p90)} />
      </div>
      {band?.definition && (
        <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
          <Info className="mt-px size-3.5 shrink-0" aria-hidden />
          <span>
            {band.definition} <VerifiedBadge verified={band.verified} />
          </span>
        </p>
      )}
    </div>
  );
}

/** The approved stock month by month against the observed large-load peak, with the dated annotations. */
function Monthly({ data, mode }: { data: LargeLoad; mode: ChartMode }) {
  const ink = INK[mode];
  const [stockColor, peakColor] = SERIES[mode];
  const months = data.monthly;
  const first = months[0]?.month;
  const last = months.at(-1)?.month;
  const notes = data.annotations
    .filter((a) => first && last && a.date.slice(0, 7) >= first.slice(0, 7) && a.date.slice(0, 7) <= last.slice(0, 7))
    .map((a, i) => ({ ...a, n: i + 1, month: months.find((m) => m.month.slice(0, 7) === a.date.slice(0, 7))?.month }));

  return (
    <SectionCard
      title="Approved stock and observed peak"
      icon={LineChartIcon}
      subtitle="MW approved to energize, month by month, against the large loads' observed peak; numbered lines mark the events below."
    >
      <div className="h-72 w-full">
        <ResponsiveContainer>
          <LineChart data={months} margin={{ top: 16, right: 16, bottom: 0, left: 8 }}>
            <CartesianGrid vertical={false} stroke={ink.grid} />
            <XAxis dataKey="month" tickFormatter={monthLabel} tickLine={false} axisLine={{ stroke: ink.axis }} tick={{ fill: ink.muted, fontSize: 11 }} minTickGap={24} />
            <YAxis tickFormatter={gwTick} tickLine={false} axisLine={false} width={52} tick={{ fill: ink.muted, fontSize: 12 }} />
            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const m = payload[0].payload as LargeLoad["monthly"][number];
                return (
                  <ChartTooltipCard
                    title={formatDate(m.month.slice(0, 7))}
                    rows={[
                      { label: "Approved stock", value: m.a2e_mw == null ? "No reading" : formatPower(m.a2e_mw), color: stockColor },
                      {
                        label: "Observed peak (simultaneous)",
                        value: m.observed_simultaneous_mw == null ? "No reading" : formatPower(m.observed_simultaneous_mw),
                        color: peakColor,
                      },
                    ]}
                  />
                );
              }}
            />
            {notes.map((note) =>
              note.month ? (
                <ReferenceLine
                  key={note.n}
                  x={note.month}
                  stroke={ink.secondary}
                  strokeDasharray="3 3"
                  label={{ value: String(note.n), position: "top", fill: ink.secondary, fontSize: 11 }}
                />
              ) : null,
            )}
            <Line dataKey="a2e_mw" stroke={stockColor} strokeWidth={2} dot={false} isAnimationActive={false} />
            <Line dataKey="observed_simultaneous_mw" stroke={peakColor} strokeWidth={2} dot={false} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="h-0.5 w-4" style={{ background: stockColor }} /> Approved to energize (stock)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-0.5 w-4" style={{ background: peakColor }} /> Observed peak, simultaneous
        </span>
        <VerifiedBadge verified={months.every((m) => m.verified !== false)} />
      </div>
      {data.annotations.length > 0 && (
        <ol className="mt-5 divide-y divide-border border-t border-border">
          {data.annotations.map((a) => {
            const n = notes.find((note) => note.date === a.date && note.title === a.title)?.n;
            return (
              <li key={`${a.date}-${a.title}`} className="flex gap-3 py-3 text-sm">
                <span
                  className={cn(
                    "flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold tabular-nums",
                    n ? "bg-muted text-foreground" : "text-muted-foreground",
                  )}
                  aria-label={n ? `Marker ${n}` : undefined}
                >
                  {n ?? "·"}
                </span>
                <div className="min-w-0 space-y-0.5">
                  <p>
                    <span className="font-medium tabular-nums">{formatDate(a.date)}</span> · <span className="font-medium">{a.title}</span>
                  </p>
                  {a.detail && <p className="text-xs text-muted-foreground">{a.detail}</p>}
                  <p className="text-xs">
                    {a.source_url ? (
                      <a href={a.source_url} target="_blank" rel="noreferrer" className="text-basecast-brand hover:underline">
                        Source
                      </a>
                    ) : (
                      <span className="text-muted-foreground">Source not verified</span>
                    )}
                  </p>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </SectionCard>
  );
}

/** The Large loads tab: the decks and the ratio band in stat cards, promised × approved by deck, the monthly stock and the annotations. */
export function LargeLoadsTab() {
  const { resolvedTheme } = useTheme();
  const mode: ChartMode = resolvedTheme === "dark" ? "dark" : "light";
  const query = useProductQuery<LargeLoad>("forecasts/large-load");
  return (
    <QueryBody<LargeLoad>
      query={query}
      compact={false}
      isEmpty={(d) => d.realization.length === 0 && d.monthly.length === 0}
      skeleton={<Skeleton className="h-96 w-full" />}
    >
      {(d, meta) => (
        <div className="space-y-4">
          <LargeLoadStats data={d} />
          <Realization data={d} mode={mode} caveats={meta.caveats} />
          <Monthly data={d} mode={mode} />
          <Provenance meta={meta} className="border-t border-border pt-3" />
        </div>
      )}
    </QueryBody>
  );
}
