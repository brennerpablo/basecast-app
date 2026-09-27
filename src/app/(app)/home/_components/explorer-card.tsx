"use client";

import { Map as MapIcon } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

import { type CountyHover, CountyMap } from "@/components/maps/county-map";
import { formatPercent, formatWhole } from "@/components/product/format";
import { KpiItem } from "@/components/product/kpi-item";
import { Skeleton } from "@/components/ui/skeleton";
import { useProductQuery } from "@/lib/bff/queries";
import { type Channel, channelColor, type Mode } from "@/lib/explorer/colors";
import { CHANNEL_LABEL, type CountiesData, paintLayer } from "@/lib/explorer/layers";
import { acquisitionSummary } from "@/lib/explorer/summary";
import { topCounties } from "@/lib/home/highlights";
import { useTheme } from "@/lib/hooks/use-theme";

import { HomeCard } from "./home-card";

const CHANNELS: Channel[] = ["retail_direct", "partnership", "mixed"];

/** The acquisition map with the Explorer's paint (hue by channel, darker by priority), hover only. */
function AcquisitionMap({ data, mode }: { data: CountiesData; mode: Mode }) {
  const [hover, setHover] = useState<CountyHover | null>(null);
  const paint = useMemo(
    () => paintLayer(data.items, { layer: "acquisition", list: "all", metric: "raw", naics: true }, mode),
    [data.items, mode],
  );
  const byFips = useMemo(() => new Map(data.items.map((row) => [row.county_fips, row])), [data.items]);
  const hovered = hover ? byFips.get(hover.fips) : undefined;
  const a = hovered?.acquisition;
  return (
    <div className="relative">
      <CountyMap
        styles={paint.styles}
        mode={mode}
        selected={null}
        onHover={setHover}
        onSelect={() => {}}
        className="h-72 overflow-hidden rounded-md border border-border bg-card"
      />
      {hovered && hover && (
        <div
          className="pointer-events-none absolute z-10 max-w-64 rounded-md border border-border bg-popover px-3 py-2 text-xs shadow-md"
          style={{ left: hover.x + 14, top: hover.y + 14 }}
        >
          <p className="font-medium text-foreground">{hovered.county_name}</p>
          <p className="text-muted-foreground">
            {!hovered.in_ercot
              ? "Outside ERCOT"
              : a
                ? `Rank ${a.rank} · class ${a.priority_class} of 5 · ${CHANNEL_LABEL[a.channel as Channel] ?? a.channel}`
                : "No acquisition score"}
          </p>
        </div>
      )}
    </div>
  );
}

/**
 * Where to go: the Explorer's acquisition layer as a small map, the count of scored and top-class counties,
 * and the five counties first in the ranking, each opening in the Explorer.
 */
export function ExplorerCard() {
  const query = useProductQuery<CountiesData>("geo/counties", undefined, { throwOnError: false });
  const { resolvedTheme } = useTheme();
  const mode: Mode = resolvedTheme === "dark" ? "dark" : "light";
  return (
    <HomeCard<CountiesData>
      icon={MapIcon}
      title="Where to go"
      subtitle="Counties by acquisition priority: hue by channel, darker by priority."
      href="/explorer"
      linkLabel="Open Explorer"
      query={query}
      isEmpty={(d) => d.items.length === 0}
      empty={{ title: "No county scored yet" }}
      skeleton={<Skeleton className="h-96 w-full" />}
    >
      {(data) => {
        const summary = acquisitionSummary(data.items);
        const top = topCounties(data.items, 5);
        return (
          <div className="space-y-5">
            <AcquisitionMap data={data} mode={mode} />
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
              {CHANNELS.map((channel) => (
                <span key={channel} className="flex items-center gap-1.5">
                  <span className="size-3 rounded-[3px]" style={{ background: channelColor(channel, 5, mode) }} />
                  {CHANNEL_LABEL[channel]}
                </span>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <KpiItem label="ERCOT counties scored" value={formatWhole(summary.scored)} />
              <KpiItem label="In the top priority class" value={formatWhole(summary.topClass)} />
            </div>
            <ol className="divide-y divide-border">
              {top.map((row) => (
                <li key={row.county_fips} className="flex items-center gap-3 py-2">
                  <span className="w-7 shrink-0 text-xs text-muted-foreground tabular-nums">#{row.acquisition.rank}</span>
                  <Link
                    href={`/explorer?county=${row.county_fips}`}
                    className="min-w-0 flex-1 truncate text-sm font-medium text-foreground hover:underline"
                  >
                    {row.county_name}
                  </Link>
                  <span className="flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground">
                    <span
                      className="size-2.5 rounded-full"
                      style={{ background: channelColor(row.acquisition.channel as Channel, row.acquisition.priority_class, mode) }}
                      aria-hidden
                    />
                    {CHANNEL_LABEL[row.acquisition.channel as Channel] ?? row.acquisition.channel}
                    <span className="max-sm:hidden">
                      · {formatPercent(row.acquisition.partner_share, { ratio: true })} co-op/muni land
                    </span>
                  </span>
                </li>
              ))}
            </ol>
          </div>
        );
      }}
    </HomeCard>
  );
}
