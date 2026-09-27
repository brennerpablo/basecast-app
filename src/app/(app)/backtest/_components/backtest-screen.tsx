"use client";

import { ArrowRight, Boxes, CalendarRange, Factory, Grid3x3, type LucideIcon, Target, Trophy } from "lucide-react";
import Link from "next/link";
import { parseAsString, parseAsStringLiteral, useQueryStates } from "nuqs";
import { useEffect } from "react";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/components-app/ui/tabs";
import { CaveatBadges } from "@/components/product/caveat-badges";
import { QueryBody } from "@/components/product/data-card";
import { Filter, FilterRow } from "@/components/product/filter";
import { formatDate } from "@/components/product/format";
import { PageHeader } from "@/components/product/page-header";
import { Provenance } from "@/components/product/provenance";
import { SectionCard } from "@/components/product/section-card";
import { SegmentedControl } from "@/components/product/segmented-control";
import { Skeleton } from "@/components/ui/skeleton";
import { BffError, isMartNotBuilt, type Meta } from "@/lib/bff/envelope";
import { useProductQuery } from "@/lib/bff/queries";
import { cn } from "@/lib/utils";

import { AsOfBar } from "./as-of-bar";
import { AsOfBody } from "./as-of-card";
import { type OfficialErrorsData, type PeakData, productViews, type QueueData } from "./backtest-data";
import { FanBody, FanStats } from "./fan-card";
import { ModelsBody } from "./models-card";
import { OfficialErrorsBody, OfficialStats, pickView } from "./official-errors-card";
import { QueueBody } from "./queue-card";
import { BacktestScorecard } from "./scorecard";
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
 * vintages have been, the generation-queue backtest and the models that ran, under a scorecard of how solid
 * the models are. State (date, views) lives in the URL.
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

  const dateFilter = !isMartNotBuilt(peak.error) && (
    <AsOfBar
      dates={dates}
      value={selected}
      onChange={(date) => void setState({ as_of: date === latest ? null : date })}
      era={era}
      pending={pending}
    />
  );
  // The provenance once per tab, at its foot: each tab reads one response, and only one tab shows at a time.
  const foot = (meta: Meta) => <Provenance meta={meta} className="border-t border-border pt-3" />;

  const tabs: { value: string; label: string; icon: LucideIcon; content: React.ReactNode }[] = [
    {
      value: "summer",
      label: data ? `Summer ${data.fan_target_year}` : "Latest summer",
      icon: Target,
      content: (
        <div className="space-y-4">
          {dateFilter}
          <QueryBody
            query={peak}
            compact={false}
            isEmpty={(d) => d.fan.length === 0}
            empty={{ title: "No forecast of the latest summer" }}
            skeleton={<Skeleton className="h-120 w-full" />}
          >
            {(d, meta) => (
              <div className={cn("space-y-4 transition-opacity", pending && "opacity-60")}>
                <FanStats data={d} meta={meta} asOf={selected ?? d.as_of} />
                <SectionCard
                  title={`Summer ${d.fan_target_year} peak forecasts`}
                  icon={Target}
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
                >
                  <FanBody data={d} meta={meta} asOf={selected ?? d.as_of} view={state.fan} />
                </SectionCard>
                {foot(meta)}
              </div>
            )}
          </QueryBody>
        </div>
      ),
    },
    {
      value: "date",
      label: "By date",
      icon: CalendarRange,
      content: (
        <div className="space-y-4">
          {dateFilter}
          <QueryBody
            query={peak}
            compact={false}
            isEmpty={(d) => d.cells.length === 0}
            empty={{ title: "No cell for this date" }}
            skeleton={<Skeleton className="h-144 w-full" />}
          >
            {(d, meta) => (
              <div className={cn("space-y-4 transition-opacity", pending && "opacity-60")}>
                <SectionCard
                  title={selected ? `As of ${formatDate(selected)}` : "Backtest date"}
                  icon={CalendarRange}
                >
                  <AsOfBody data={d} meta={meta} />
                </SectionCard>
                {foot(meta)}
              </div>
            )}
          </QueryBody>
        </div>
      ),
    },
    {
      value: "scores",
      label: "Scores by era",
      icon: Trophy,
      content: (
        <QueryBody
          query={peak}
          compact={false}
          isEmpty={(d) => d.scores.length === 0 && d.comparisons.length === 0}
          empty={{ title: "No scores yet" }}
          skeleton={<Skeleton className="h-96 w-full" />}
        >
          {(d, meta) => (
            <div className="space-y-4">
              <ScoresBody data={d} />
              {foot(meta)}
            </div>
          )}
        </QueryBody>
      ),
    },
    {
      value: "official",
      label: "Official vintages",
      icon: Grid3x3,
      content: (
        <div className="space-y-4">
          {views.length > 1 && view && (
            <FilterRow>
              <Filter label="Official product">
                <SegmentedControl
                  label="Official product"
                  options={views.map((value) => ({ value, label: value }))}
                  value={view}
                  onChange={(product) => void setState({ product: product === pickView(views, null) ? null : product })}
                />
              </Filter>
            </FilterRow>
          )}
          <QueryBody
            query={errors}
            compact={false}
            isEmpty={(d) => d.items.length === 0 || !view}
            empty={{ title: "No official vintage scored yet" }}
            skeleton={<Skeleton className="h-96 w-full" />}
          >
            {(d, meta) =>
              view ? (
                <div className="space-y-4">
                  <OfficialStats data={d} view={view} />
                  <SectionCard
                    title="Official forecast error (% of actual peak)"
                    icon={Grid3x3}
                    caveats={meta.caveats}
                  >
                    <OfficialErrorsBody data={d} meta={meta} view={view} />
                  </SectionCard>
                  {foot(meta)}
                </div>
              ) : null
            }
          </QueryBody>
        </div>
      ),
    },
    {
      value: "queue",
      label: "Generation queue",
      icon: Factory,
      content: (
        <QueryBody
          query={queue}
          compact={false}
          isEmpty={(d) => d.items.length === 0 && d.county_rank.length === 0}
          empty={{ title: "No queue snapshot backtested yet" }}
          skeleton={<Skeleton className="h-80 w-full" />}
        >
          {(d, meta) => (
            <div className="space-y-4">
              <SectionCard
                title="Generation queue backtest"
                icon={Factory}
                caveats={meta.caveats}
                action={
                  <Link
                    href="/explorer?layer=queue"
                    className="inline-flex items-center gap-1 text-xs font-medium whitespace-nowrap text-basecast-brand hover:underline"
                  >
                    Adjusted queue on the map
                    <ArrowRight className="size-3" aria-hidden />
                  </Link>
                }
              >
                <QueueBody data={d} />
              </SectionCard>
              {foot(meta)}
            </div>
          )}
        </QueryBody>
      ),
    },
    {
      value: "models",
      label: "Models",
      icon: Boxes,
      content: (
        <QueryBody query={peak} compact={false} skeleton={<Skeleton className="h-96 w-full" />}>
          {(d, meta) => (
            <div className="space-y-4">
              <ModelsBody peak={d} meta={meta} queue={queue.data?.data} />
              {foot(meta)}
            </div>
          )}
        </QueryBody>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Backtest">
        <CaveatBadges caveats={peak.data?.meta.caveats} />
      </PageHeader>
      <BacktestScorecard
        peak={data}
        queue={queue.data?.data}
        loading={{ peak: peak.isPending && !peak.error, queue: queue.isPending && !queue.error }}
      />
      <Tabs urlParam="tab" defaultValue="summer" className="space-y-6">
        <TabsList variant="line" color="brand" className="max-w-full overflow-x-auto">
          {tabs.map(({ value, label, icon: Icon }) => (
            <TabsTrigger key={value} value={value} className="shrink-0">
              <Icon className="mr-1.5 size-3.5" aria-hidden />
              {label}
            </TabsTrigger>
          ))}
        </TabsList>
        {tabs.map(({ value, content }) => (
          <TabsContent key={value} value={value}>
            {content}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
