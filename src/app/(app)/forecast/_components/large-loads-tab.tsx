"use client";

import { parseAsInteger, useQueryStates } from "nuqs";
import { useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { VerifiedBadge } from "@/components/product/caveat-badges";
import { DataCard } from "@/components/product/data-card";
import { formatDate, formatPercent, formatPower, GAP } from "@/components/product/format";
import { SectionCard } from "@/components/product/section-card";
import { SegmentedControl } from "@/components/product/segmented-control";
import { Skeleton } from "@/components/ui/skeleton";
import type { components } from "@/lib/api/get-data";
import type { Meta } from "@/lib/bff/envelope";
import { useProductQuery } from "@/lib/bff/queries";
import { type ChartMode, gwTick, INK, SERIES } from "@/lib/charts/palette";
import { useTheme } from "@/lib/hooks/use-theme";

import { ChartTooltipCard } from "./chart-tooltip";

type LargeLoad = components["schemas"]["LargeLoadData"];

const MONTH = new Intl.DateTimeFormat("en-US", { timeZone: "UTC", month: "short", year: "2-digit" });
const monthLabel = (iso: string) => MONTH.format(new Date(`${iso.slice(0, 10)}T00:00:00Z`));

/** Promised × approved: for one target year, what each monthly deck promised and what got approved by then. */
function Realization({ data, meta, mode }: { data: LargeLoad; meta: Meta; mode: ChartMode }) {
  const years = useMemo(() => [...new Set(data.realization.map((r) => r.target_year))].sort(), [data]);
  const [{ target }, setState] = useQueryStates({ target: parseAsInteger });
  const year = target && years.includes(target) ? target : years[0];
  const rows = data.realization.filter((r) => r.target_year === year);
  const ink = INK[mode];
  const [promisedColor, approvedColor] = SERIES[mode];

  return (
    <SectionCard
      title="Promised × approved, by deck"
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
      meta={meta}
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
                        label: "Approved by then",
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
            <Bar dataKey="realized_a2e_mw" fill={approvedColor} radius={[4, 4, 0, 0]} isAnimationActive={false} />
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
        {rows.some((r) => r.realized_a2e_mw == null) && <span>No orange bar: the year has not closed yet.</span>}
        <VerifiedBadge verified={rows.every((r) => r.verified !== false)} />
      </div>
    </SectionCard>
  );
}

/** The realization ratio band the forecast uses, with the API's definition. */
function RatioBand({ data, meta }: { data: LargeLoad; meta: Meta }) {
  const band = data.ratio_band;
  if (!band) return null;
  return (
    <SectionCard title="Realization ratio" action={<VerifiedBadge verified={band.verified} />} meta={meta}>
      <dl className="grid grid-cols-3 gap-4">
        {(
          [
            ["P10", band.p10],
            ["P50", band.p50],
            ["P90", band.p90],
          ] as const
        ).map(([label, value]) => (
          <div key={label}>
            <dt className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">{label}</dt>
            <dd className="mt-0.5 text-2xl font-semibold tabular-nums">{value == null ? GAP : formatPercent(value, { ratio: true })}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-3 text-xs text-muted-foreground">{band.definition}</p>
      <p className="mt-2 text-xs text-muted-foreground">From the deck of {formatDate(band.deck_vintage)}, the one the default forecast variant reads.</p>
    </SectionCard>
  );
}

/** The approved stock month by month against the observed large-load peak, with the dated annotations. */
function Monthly({ data, meta, mode }: { data: LargeLoad; meta: Meta; mode: ChartMode }) {
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
      subtitle="MW approved to energize, month by month, against the large loads' observed peak."
      meta={meta}
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
        <ol className="mt-4 space-y-1.5 text-xs">
          {data.annotations.map((a) => {
            const n = notes.find((note) => note.date === a.date && note.title === a.title)?.n;
            return (
              <li key={`${a.date}-${a.title}`} className="flex gap-2">
                <span className="w-4 shrink-0 text-right font-medium text-muted-foreground tabular-nums">{n ?? "·"}</span>
                <span>
                  <span className="font-medium tabular-nums">{formatDate(a.date)}</span> · {a.title}
                  {a.detail && <span className="text-muted-foreground"> — {a.detail}</span>}
                  <span className="text-muted-foreground">
                    {" "}
                    ·{" "}
                    {a.source_url ? (
                      <a href={a.source_url} target="_blank" rel="noreferrer" className="underline hover:text-foreground">
                        source
                      </a>
                    ) : (
                      "source not verified"
                    )}
                  </span>
                </span>
              </li>
            );
          })}
        </ol>
      )}
    </SectionCard>
  );
}

/** The Large loads tab: promised × approved by deck, the ratio band, the monthly stock and the annotations. */
export function LargeLoadsTab() {
  const { resolvedTheme } = useTheme();
  const mode: ChartMode = resolvedTheme === "dark" ? "dark" : "light";
  const query = useProductQuery<LargeLoad>("forecasts/large-load");
  const envelope = query.data;
  return (
    <div className="space-y-4">
      <DataCard<LargeLoad>
        title="Large loads: promised, approved, energized"
        subtitle="ERCOT's large-load decks, read month by month: what was promised and what got approved."
        query={query}
        isEmpty={(d) => d.realization.length === 0 && d.monthly.length === 0}
        skeleton={<Skeleton className="h-24 w-full" />}
      >
        {() => (
          <p className="text-sm text-muted-foreground">
            {envelope?.data.deck_vintages?.length
              ? `${envelope.data.deck_vintages.length} decks, from ${formatDate(envelope.data.deck_vintages[0])} to ${formatDate(envelope.data.deck_vintages.at(-1))}.`
              : GAP}
          </p>
        )}
      </DataCard>
      {envelope && (
        <>
          <div className="grid gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
            <Realization data={envelope.data} meta={envelope.meta} mode={mode} />
            <RatioBand data={envelope.data} meta={envelope.meta} />
          </div>
          <Monthly data={envelope.data} meta={envelope.meta} mode={mode} />
        </>
      )}
    </div>
  );
}
