"use client";

import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { parseAsString, parseAsStringLiteral, useQueryStates } from "nuqs";
import { useEffect } from "react";

import { DataCard } from "@/components/product/data-card";
import { formatDate } from "@/components/product/format";
import { SegmentedControl } from "@/components/product/segmented-control";
import { Skeleton } from "@/components/ui/skeleton";
import { BffError, isMartNotBuilt } from "@/lib/bff/envelope";
import { useProductQuery } from "@/lib/bff/queries";
import { cn } from "@/lib/utils";

import { AsOfBar } from "./as-of-bar";
import { AsOfBody } from "./as-of-card";
import { type OfficialErrorsData, type PeakData, productViews, type QueueData } from "./backtest-data";
import { FanBody } from "./fan-card";
import { OfficialErrorsBody, pickView } from "./official-errors-card";
import { QueueBody } from "./queue-card";
import { ScoresBody } from "./scores-card";

const FAN_VIEWS = ["chart", "table"] as const;

const backtestParsers = {
  /** One of the API's `as_of_dates`; none = the latest. */
  as_of: parseAsString,
  fan: parseAsStringLiteral(FAN_VIEWS).withDefault("chart"),
  /** The official product in the vintage matrix; none = LTLF. */
  product: parseAsString,
};

/** 422 `invalid_as_of`: the date in the URL is not a backtest date. */
const isInvalidAsOf = (error: unknown) => error instanceof BffError && error.status === 422;

function ScreenSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-24 w-full" />
      <Skeleton className="h-136 w-full" />
      <Skeleton className="h-96 w-full" />
    </div>
  );
}

/**
 * /backtest: how our peak model would have done at each past date against ERCOT's official forecasts and
 * the actual (the latest summer's fan, one date at a time, the scores by era), how far off the official
 * vintages have been, and the generation-queue backtest. State (date, views) lives in the URL.
 */
export function BacktestScreen() {
  const [state, setState] = useQueryStates(backtestParsers);

  const peak = useProductQuery<PeakData>(
    "backtest/peak",
    { as_of: state.as_of ?? undefined },
    { keepPrevious: true, throwOnError: false },
  );
  const errors = useProductQuery<OfficialErrorsData>("backtest/official-errors");
  const queue = useProductQuery<QueueData>("backtest/queue");

  const invalidAsOf = isInvalidAsOf(peak.error);
  // A date the API does not know goes back to the default (the latest) instead of an error page.
  useEffect(() => {
    if (invalidAsOf) void setState({ as_of: null });
  }, [invalidAsOf, setState]);
  if (peak.error && !peak.data && !invalidAsOf && !isMartNotBuilt(peak.error)) throw peak.error;
  if (invalidAsOf && !peak.data) return <ScreenSkeleton />;

  const data = peak.data?.data;
  const dates = data?.as_of_dates;
  const selected = state.as_of && dates?.includes(state.as_of) ? state.as_of : data?.as_of;
  const shownEra = data?.cells[0]?.era;
  const era = data?.eras.find((e) => e.era === shownEra);
  const pending = peak.isPlaceholderData;
  const latest = dates?.[dates.length - 1];

  const views = productViews(errors.data?.data.products ?? []);
  const view = pickView(views, state.product);

  return (
    <div className="space-y-4">
      {!isMartNotBuilt(peak.error) && (
        <AsOfBar
          dates={dates}
          value={selected}
          onChange={(date) => void setState({ as_of: date === latest ? null : date })}
          era={era}
          pending={pending}
        />
      )}

      <DataCard
        title={data ? `Summer ${data.fan_target_year}: every forecast against the actual` : "The latest summer: every forecast against the actual"}
        subtitle="The official vintages by publication date, ERCOT's own range, and basecast at each backtest date."
        action={
          <SegmentedControl
            label="Fan view"
            options={[
              { value: "chart", label: "Chart" },
              { value: "table", label: "Table" },
            ]}
            value={state.fan}
            onChange={(fan) => void setState({ fan: fan === "chart" ? null : fan })}
          />
        }
        query={peak}
        isEmpty={(d) => d.fan.length === 0}
        empty={{ title: "No forecast of the latest summer", description: "The fan mart has no rows yet." }}
        skeleton={<Skeleton className="h-120 w-full" />}
      >
        {(d, meta) => (
          <div className={cn("transition-opacity", pending && "opacity-60")}>
            <FanBody data={d} meta={meta} asOf={selected ?? d.as_of} view={state.fan} />
          </div>
        )}
      </DataCard>

      <DataCard
        title={selected ? `As of ${formatDate(selected)}: basecast against the official vintages` : "One backtest date"}
        subtitle="Every summer the date could forecast, the official vintage published by then, and the actual."
        query={peak}
        isEmpty={(d) => d.cells.length === 0}
        empty={{ title: "No cell for this date" }}
        skeleton={<Skeleton className="h-144 w-full" />}
      >
        {(d, meta) => (
          <div className={cn("transition-opacity", pending && "opacity-60")}>
            <AsOfBody data={d} meta={meta} />
          </div>
        )}
      </DataCard>

      <DataCard
        title="Scores by era"
        subtitle="Over every backtest date, by era; hover an era for where it starts and why."
        query={peak}
        isEmpty={(d) => d.scores.length === 0 && d.comparisons.length === 0}
        empty={{ title: "No scores yet" }}
        skeleton={<Skeleton className="h-96 w-full" />}
      >
        {(d, meta) => <ScoresBody data={d} meta={meta} />}
      </DataCard>

      <DataCard
        title="How far off the official forecasts were"
        subtitle="Every official vintage against every summer it forecast, as the error in % of the actual peak."
        action={
          views.length > 1 && view ? (
            <SegmentedControl
              label="Official product"
              options={views.map((value) => ({ value, label: value }))}
              value={view}
              onChange={(product) => void setState({ product: product === pickView(views, null) ? null : product })}
            />
          ) : undefined
        }
        query={errors}
        isEmpty={(d) => d.items.length === 0 || !view}
        empty={{ title: "No official vintage scored yet" }}
        skeleton={<Skeleton className="h-96 w-full" />}
      >
        {(d, meta) => (view ? <OfficialErrorsBody data={d} meta={meta} view={view} /> : null)}
      </DataCard>

      <DataCard
        title="Generation queue backtest"
        subtitle="The adjusted generation queue rerun on past queue reports: predicted against built, the raw queue and the developers' own dates."
        action={
          <Link
            href="/explorer?layer=queue"
            className="inline-flex items-center gap-1 text-xs font-medium whitespace-nowrap text-basecast-brand hover:underline"
          >
            Adjusted queue on the map
            <ArrowRight className="size-3" aria-hidden />
          </Link>
        }
        query={queue}
        isEmpty={(d) => d.items.length === 0 && d.county_rank.length === 0}
        empty={{ title: "No queue snapshot backtested yet" }}
        skeleton={<Skeleton className="h-80 w-full" />}
      >
        {(d) => <QueueBody data={d} />}
      </DataCard>
    </div>
  );
}
