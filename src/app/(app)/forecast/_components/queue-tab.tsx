"use client";

import { CalendarCheck, Factory } from "lucide-react";
import { parseAsString, parseAsStringLiteral, useQueryStates } from "nuqs";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { ChartTooltipCard } from "@/components/product/chart-tooltip";
import { DashboardStatCard } from "@/components/product/dashboard-stat-card";
import { QueryBody } from "@/components/product/data-card";
import { Filter, FilterRow } from "@/components/product/filter";
import { formatDate, formatPercent, formatWhole, GAP } from "@/components/product/format";
import { Provenance } from "@/components/product/provenance";
import { SectionCard } from "@/components/product/section-card";
import { SegmentedControl } from "@/components/product/segmented-control";
import { Skeleton } from "@/components/ui/skeleton";
import type { components } from "@/lib/api/get-data";
import { useProductQuery } from "@/lib/bff/queries";
import { type ChartMode, INK, SERIES } from "@/lib/charts/palette";
import { useTheme } from "@/lib/hooks/use-theme";

type Curves = components["schemas"]["QueueCurvesData"];

const STRATUM_LABEL: Record<string, string> = { all: "All fuels", solar: "Solar", storage: "Storage", wind: "Wind", gas_other: "Gas & other" };
const STAGE_LABEL: Record<string, string> = { entry: "Entry", ia: "Signed IA" };

const parsers = {
  stage: parseAsStringLiteral(["entry", "ia"] as const).withDefault("entry"),
  stratum: parseAsString.withDefault("all"),
  weighting: parseAsStringLiteral(["count", "mw"] as const).withDefault("mw"),
};

/**
 * The generation queue's survival curves (Q6/X2): the share of projects (or MW) reaching COD and the share
 * withdrawn, month by month since the stage began. Where fewer than 10 projects remain at risk the API nulls
 * the values, and the lines stop.
 */
export function QueueTab() {
  const [state, setState] = useQueryStates(parsers);
  const { resolvedTheme } = useTheme();
  const mode: ChartMode = resolvedTheme === "dark" ? "dark" : "light";
  const query = useProductQuery<Curves>("forecasts/queue-curves");
  const data = query.data?.data;
  const strata = data ? [...new Set(data.curves.map((c) => c.stratum))] : [];
  const weightings = data ? [...new Set(data.curves.map((c) => c.weighting))] : [];
  const ink = INK[mode];
  const [codColor, withdrawnColor] = SERIES[mode];

  return (
    <div className="space-y-4">
      {data && (
        <FilterRow>
          <Filter label="Stage">
            <SegmentedControl
              label="Stage"
              options={(["entry", "ia"] as const).map((v) => ({ value: v, label: STAGE_LABEL[v] }))}
              value={state.stage}
              onChange={(stage) => void setState({ stage: stage === "entry" ? null : stage })}
            />
          </Filter>
          <Filter label="Fuel">
            <SegmentedControl
              label="Fuel"
              options={strata.map((v) => ({ value: v, label: STRATUM_LABEL[v] ?? v }))}
              value={state.stratum}
              onChange={(stratum) => void setState({ stratum: stratum === "all" ? null : stratum })}
            />
          </Filter>
          {weightings.length > 1 && (
            <Filter label="Measure">
              <SegmentedControl
                label="Measure"
                options={(["mw", "count"] as const).filter((w) => weightings.includes(w)).map((v) => ({ value: v, label: v === "mw" ? "By MW" : "By project count" }))}
                value={state.weighting}
                onChange={(weighting) => void setState({ weighting: weighting === "mw" ? null : weighting })}
              />
            </Filter>
          )}
        </FilterRow>
      )}
      <QueryBody<Curves> query={query} compact={false} isEmpty={(d) => d.curves.length === 0} skeleton={<Skeleton className="h-96 w-full" />}>
        {(d, meta) => {
          const curve = d.curves.find((c) => c.stage === state.stage && c.stratum === state.stratum && c.weighting === state.weighting);
          const milestones = d.milestones.filter(
            (m) => m.stage === state.stage && m.stratum === state.stratum && m.weighting === state.weighting,
          );
          const points = (curve?.points ?? []).map((p) => ({
            ...p,
            cod: p.supported && p.cif_cod != null ? p.cif_cod * 100 : null,
            withdrawn: p.supported && p.cif_withdrawn != null ? p.cif_withdrawn * 100 : null,
          }));
          const cut = curve?.points.find((p) => !p.supported);
          return (
            <div className="space-y-4">
              {milestones.length > 0 && (
                <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
                  {milestones.map((m) => (
                    <DashboardStatCard
                      key={m.month}
                      layout="stacked"
                      icon={<CalendarCheck className="size-4" aria-hidden />}
                      title={`COD within ${m.month} months`}
                      value={m.supported && m.cif_cod != null ? formatPercent(m.cif_cod, { ratio: true }) : GAP}
                    />
                  ))}
                </div>
              )}
              <SectionCard
                title={`COD vs withdrawn · ${STRATUM_LABEL[state.stratum] ?? state.stratum}`}
                icon={Factory}
                subtitle={d.as_of_month ? `${formatDate(d.as_of_month)} report` : undefined}
                caveats={meta.caveats}
              >
                {!curve ? (
                  <p className="text-sm text-muted-foreground">No curve for this combination.</p>
                ) : (
                  <div className="space-y-3">
                    <div className="h-80 w-full">
                      <ResponsiveContainer>
                        <LineChart data={points} margin={{ top: 8, right: 16, bottom: 12, left: 8 }}>
                          <CartesianGrid vertical={false} stroke={ink.grid} />
                          <XAxis
                            dataKey="month"
                            type="number"
                            domain={[0, "dataMax"]}
                            tickLine={false}
                            axisLine={{ stroke: ink.axis }}
                            tick={{ fill: ink.muted, fontSize: 12 }}
                            label={{ value: "Months since the stage began", position: "insideBottom", offset: -8, fill: ink.muted, fontSize: 11 }}
                          />
                          <YAxis tickFormatter={(v: number) => `${v}%`} tickLine={false} axisLine={false} width={44} tick={{ fill: ink.muted, fontSize: 12 }} />
                          <Tooltip
                            content={({ active, payload }) => {
                              if (!active || !payload?.length) return null;
                              const p = payload[0].payload as (typeof points)[number];
                              return (
                                <ChartTooltipCard
                                  title={`Month ${p.month}`}
                                  rows={[
                                    { label: "Reached COD", value: p.cod == null ? "Too few at risk" : formatPercent(p.cod), color: codColor },
                                    { label: "Withdrawn", value: p.withdrawn == null ? "Too few at risk" : formatPercent(p.withdrawn), color: withdrawnColor },
                                    { label: "Still at risk", value: formatWhole(p.at_risk) },
                                  ]}
                                />
                              );
                            }}
                          />
                          <Line dataKey="cod" stroke={codColor} strokeWidth={2} dot={false} isAnimationActive={false} />
                          <Line dataKey="withdrawn" stroke={withdrawnColor} strokeWidth={2} dot={false} isAnimationActive={false} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1.5">
                        <span className="h-0.5 w-4" style={{ background: codColor }} /> Reached COD
                      </span>
                      <span className="flex items-center gap-1.5">
                        <span className="h-0.5 w-4" style={{ background: withdrawnColor }} /> Withdrawn
                      </span>
                      {cut && <span>Cut at month {cut.month} (&lt;10 at risk)</span>}
                    </div>
                  </div>
                )}
              </SectionCard>
              <Provenance meta={meta} className="border-t border-border pt-3" />
            </div>
          );
        }}
      </QueryBody>
    </div>
  );
}
