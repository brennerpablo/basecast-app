"use client";

import { parseAsString, parseAsStringLiteral, useQueryStates } from "nuqs";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { DataCard } from "@/components/product/data-card";
import { formatDate, formatPercent, formatWhole, GAP } from "@/components/product/format";
import { SegmentedControl } from "@/components/product/segmented-control";
import { Skeleton } from "@/components/ui/skeleton";
import type { components } from "@/lib/api/get-data";
import { useProductQuery } from "@/lib/bff/queries";
import { type ChartMode, INK, SERIES } from "@/lib/charts/palette";
import { useTheme } from "@/lib/hooks/use-theme";

import { ChartTooltipCard } from "./chart-tooltip";

type Curves = components["schemas"]["QueueCurvesData"];

const STRATUM_LABEL: Record<string, string> = { all: "All fuels", solar: "Solar", storage: "Storage", wind: "Wind", gas_other: "Gas & other" };
const STAGE_LABEL: Record<string, string> = { entry: "From entry", ia: "From the signed IA" };

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
        <div className="flex flex-wrap items-center gap-2">
          <SegmentedControl
            label="Stage"
            options={(["entry", "ia"] as const).map((v) => ({ value: v, label: STAGE_LABEL[v] }))}
            value={state.stage}
            onChange={(stage) => void setState({ stage: stage === "entry" ? null : stage })}
          />
          <SegmentedControl
            label="Stratum"
            options={strata.map((v) => ({ value: v, label: STRATUM_LABEL[v] ?? v }))}
            value={state.stratum}
            onChange={(stratum) => void setState({ stratum: stratum === "all" ? null : stratum })}
          />
          {weightings.length > 1 && (
            <SegmentedControl
              label="Weighting"
              options={(["mw", "count"] as const).filter((w) => weightings.includes(w)).map((v) => ({ value: v, label: v === "mw" ? "By MW" : "By project count" }))}
              value={state.weighting}
              onChange={(weighting) => void setState({ weighting: weighting === "mw" ? null : weighting })}
            />
          )}
        </div>
      )}
      <DataCard<Curves>
        title={`Generation queue: what reaches COD, what withdraws · ${STRATUM_LABEL[state.stratum] ?? state.stratum}`}
        subtitle={data?.as_of_month ? `Cumulative shares since the stage began · ${formatDate(data.as_of_month)} report.` : undefined}
        query={query}
        isEmpty={(d) => d.curves.length === 0}
        skeleton={<Skeleton className="h-80 w-full" />}
      >
        {(d) => {
          const curve = d.curves.find((c) => c.stage === state.stage && c.stratum === state.stratum && c.weighting === state.weighting);
          if (!curve) return <p className="text-sm text-muted-foreground">No curve for this combination.</p>;
          const milestones = d.milestones.filter(
            (m) => m.stage === state.stage && m.stratum === state.stratum && m.weighting === state.weighting,
          );
          const points = curve.points.map((p) => ({
            ...p,
            cod: p.supported && p.cif_cod != null ? p.cif_cod * 100 : null,
            withdrawn: p.supported && p.cif_withdrawn != null ? p.cif_withdrawn * 100 : null,
          }));
          const cut = curve.points.find((p) => !p.supported);
          return (
            <div className="space-y-4">
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
                  <span className="h-0.5 w-4" style={{ background: codColor }} /> Reached commercial operation
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-0.5 w-4" style={{ background: withdrawnColor }} /> Withdrawn
                </span>
                {cut && <span>Lines stop at month {cut.month}: fewer than 10 projects left at risk.</span>}
              </div>
              {milestones.length > 0 && (
                <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                  {milestones.map((m) => (
                    <div key={m.month}>
                      <dt className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">COD within {m.month} months</dt>
                      <dd className="mt-0.5 text-xl font-semibold tabular-nums">
                        {m.supported && m.cif_cod != null ? formatPercent(m.cif_cod, { ratio: true }) : GAP}
                      </dd>
                    </div>
                  ))}
                </dl>
              )}
            </div>
          );
        }}
      </DataCard>
    </div>
  );
}
