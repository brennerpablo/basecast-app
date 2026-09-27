"use client";

import { DollarSign, Receipt, Table2, Users, Zap } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { AppBadge } from "@/components/components-app/ui/badge";
import { ChartTooltipCard } from "@/components/product/chart-tooltip";
import { formatValue, formatWhole, GAP } from "@/components/product/format";
import { SectionCard } from "@/components/product/section-card";
import type { AccountDetail } from "@/lib/accounts/labels";
import { type ChartMode, INK, SERIES } from "@/lib/charts/palette";
import { useTheme } from "@/lib/hooks/use-theme";

const th = "py-2 pr-3 font-medium text-right";
const num = "py-2 pr-3 text-right tabular-nums whitespace-nowrap";

/** EIA-861 by year as a table: customers, meters, sales, revenue and prices, with the early release marked. */
function EiaTable({ account, className }: { account: AccountDetail; className?: string }) {
  const years = account.eia_series;
  return (
    <SectionCard
      title="EIA-861 by year"
      icon={Table2}
      subtitle="Meters include delivery-only customers; sales, revenue and prices are bundled only."
      className={className}
    >
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

type Year = AccountDetail["eia_series"][number];
type Row = Year & { label: string };

const compact = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 });
const usdCompact = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", notation: "compact", maximumFractionDigits: 1 });
const cents = (usdPerKwh: number) => `${(usdPerKwh * 100).toFixed(1)}¢`;
/** The early release fades: lighter bars, hollow points. */
const EARLY_OPACITY = 0.45;

/** One EIA measure over the years, as bars (a quantity per year) or a line (a level). */
function YearChart({
  rows,
  mode,
  kind,
  dataKey,
  tick,
  format,
  label,
}: {
  rows: Row[];
  mode: ChartMode;
  kind: "bar" | "line";
  dataKey: keyof Year;
  tick: (value: number) => string;
  format: (value: number | null | undefined) => string;
  label: string;
}) {
  const ink = INK[mode];
  const color = SERIES[mode][0];
  const axes = (
    <>
      <CartesianGrid vertical={false} stroke={ink.grid} />
      <XAxis dataKey="label" tickLine={false} axisLine={{ stroke: ink.axis }} tick={{ fill: ink.muted, fontSize: 11 }} interval="preserveStartEnd" />
      <YAxis tickFormatter={tick} tickLine={false} axisLine={false} width={52} tick={{ fill: ink.muted, fontSize: 11 }} domain={kind === "line" ? ["auto", "auto"] : [0, "auto"]} />
      <Tooltip
        cursor={kind === "bar" ? { fill: ink.grid, opacity: 0.4 } : { stroke: ink.axis }}
        content={({ active, payload }) => {
          if (!active || !payload?.length) return null;
          const row = payload[0].payload as Row;
          return (
            <ChartTooltipCard
              title={`${row.data_year}${row.early_release ? " · early release" : ""}`}
              rows={[{ label, value: format(row[dataKey] as number | null), color }]}
            />
          );
        }}
      />
    </>
  );
  return (
    <div className="h-52 w-full">
      <ResponsiveContainer>
        {kind === "bar" ? (
          <BarChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
            {axes}
            <Bar dataKey={dataKey as string} fill={color} radius={[4, 4, 0, 0]} maxBarSize={28} isAnimationActive={false}>
              {rows.map((row) => (
                <Cell key={row.label} fillOpacity={row.early_release ? EARLY_OPACITY : 1} />
              ))}
            </Bar>
          </BarChart>
        ) : (
          <LineChart data={rows} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
            {axes}
            <Line
              dataKey={dataKey as string}
              stroke={color}
              strokeWidth={2}
              isAnimationActive={false}
              activeDot={{ r: 4 }}
              dot={(props: { cx?: number; cy?: number; index?: number }) =>
                rows[props.index ?? 0]?.early_release && props.cx != null && props.cy != null ? (
                  <circle key={`early-${props.index}`} cx={props.cx} cy={props.cy} r={4} fill="hsl(var(--card))" stroke={color} strokeWidth={2} />
                ) : (
                  <g key={`dot-${props.index}`} />
                )
              }
            />
          </LineChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}

/** The two prices on one scale (both ¢/kWh): two series, so a legend under the chart. */
function PriceChart({ rows, mode }: { rows: Row[]; mode: ChartMode }) {
  const ink = INK[mode];
  const [avg, res] = SERIES[mode];
  return (
    <>
      <div className="h-52 w-full">
        <ResponsiveContainer>
          <LineChart data={rows} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
            <CartesianGrid vertical={false} stroke={ink.grid} />
            <XAxis dataKey="label" tickLine={false} axisLine={{ stroke: ink.axis }} tick={{ fill: ink.muted, fontSize: 11 }} interval="preserveStartEnd" />
            <YAxis tickFormatter={cents} tickLine={false} axisLine={false} width={44} tick={{ fill: ink.muted, fontSize: 11 }} domain={["auto", "auto"]} />
            <Tooltip
              cursor={{ stroke: ink.axis }}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const row = payload[0].payload as Row;
                return (
                  <ChartTooltipCard
                    title={`${row.data_year}${row.early_release ? " · early release" : ""}`}
                    rows={[
                      { label: "Average (all classes)", value: formatValue(row.price_usd_kwh, "USD/kWh"), color: avg },
                      { label: "Residential", value: formatValue(row.res_price_usd_kwh, "USD/kWh"), color: res },
                    ]}
                  />
                );
              }}
            />
            <Line dataKey="price_usd_kwh" stroke={avg} strokeWidth={2} dot={false} activeDot={{ r: 4 }} isAnimationActive={false} />
            <Line dataKey="res_price_usd_kwh" stroke={res} strokeWidth={2} dot={false} activeDot={{ r: 4 }} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="h-0.5 w-3 rounded" style={{ background: avg }} /> Average (all classes)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-0.5 w-3 rounded" style={{ background: res }} /> Residential
        </span>
      </div>
    </>
  );
}

/**
 * EIA series: meters, retail sales, revenue and prices over the years (the early release lighter), then the
 * numbers as a table.
 */
export function EiaTab({ account }: { account: AccountDetail }) {
  const { resolvedTheme } = useTheme();
  const mode: ChartMode = resolvedTheme === "dark" ? "dark" : "light";
  const rows: Row[] = [...account.eia_series]
    .sort((a, b) => a.data_year - b.data_year || Number(a.early_release) - Number(b.early_release))
    .map((y) => ({ ...y, label: `${y.data_year}${y.early_release ? "*" : ""}` }));
  if (!rows.length) return <EiaTable account={account} />;
  const early = rows.some((r) => r.early_release);
  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-2">
        <SectionCard title="Meters" icon={Users} subtitle="All classes, including delivery-only.">
          <YearChart rows={rows} mode={mode} kind="line" dataKey="meters" tick={compact.format} format={formatWhole} label="Meters" />
        </SectionCard>
        <SectionCard title="Retail sales" icon={Zap} subtitle="MWh a year, bundled service.">
          <YearChart rows={rows} mode={mode} kind="bar" dataKey="sales_mwh" tick={compact.format} format={(v) => formatValue(v, "MWh")} label="Sales" />
        </SectionCard>
        <SectionCard title="Retail revenue" icon={DollarSign} subtitle="A year, bundled service.">
          <YearChart
            rows={rows}
            mode={mode}
            kind="bar"
            dataKey="revenue_kusd"
            tick={(v) => usdCompact.format(v * 1_000)}
            format={(v) => formatValue(v, "thousand USD")}
            label="Revenue"
          />
        </SectionCard>
        <SectionCard title="Prices" icon={Receipt} subtitle="Revenue ÷ sales, ¢/kWh.">
          <PriceChart rows={rows} mode={mode} />
        </SectionCard>
      </div>
      {early && <p className="text-xs text-muted-foreground">* EIA&apos;s early release: lighter bars and hollow points; it can change when the final data lands.</p>}
      <EiaTable account={account} />
    </div>
  );
}
