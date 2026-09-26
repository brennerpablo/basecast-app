"use client";

import { ChevronLeft, ChevronRight, History } from "lucide-react";
import { parseAsBoolean, parseAsInteger, useQueryStates } from "nuqs";

import { AppBadge } from "@/components/components-app/ui/badge";
import { formatDate, formatPercent, formatWhole } from "@/components/product/format";
import { SectionCard } from "@/components/product/section-card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { type AccountDetail, type AccountEvent, type EventsPage, useCodeLabels } from "@/lib/accounts/labels";
import type { Caveat, Meta } from "@/lib/bff/envelope";
import { useProductQuery } from "@/lib/bff/queries";
import { cn } from "@/lib/utils";

import { CodeBadge } from "../../_components/account-bits";

const DAY_MS = 86_400_000;
/** The whole history the timeline draws, and one page of the "full history" table. */
const TIMELINE_LIMIT = 500;
const HISTORY_PAGE = 50;

const utc = (date: string) => Date.parse(`${date}T00:00:00Z`);

/** Where the event sits: its county and the account's share of it, or a match by name. */
function eventPlace(event: AccountEvent): string {
  if (event.mapping === "name" || !event.county_name) return "By name";
  return `${event.county_name} · ${formatPercent(event.exposure, { ratio: true })} of the county`;
}

/**
 * Every event on a time axis ending at the diagnosis date, the 12-month window that makes an event active
 * shaded; strong events on the upper row, context events on the lower one.
 */
function EventTimeline({ events, asOf }: { events: AccountEvent[]; asOf: string }) {
  const { label } = useCodeLabels();
  const end = utc(asOf);
  const window = new Date(end);
  window.setUTCFullYear(window.getUTCFullYear() - 1);
  const windowStart = window.getTime();
  const start = Math.min(windowStart - 180 * DAY_MS, ...events.map((e) => utc(e.event_date)));
  const x = (t: number) => `${((t - start) / (end - start)) * 100}%`;
  const years: number[] = [];
  for (let y = new Date(start).getUTCFullYear() + 1; y <= new Date(end).getUTCFullYear(); y += 1) years.push(y);

  return (
    <div className="space-y-1.5">
      <div className="relative h-20" role="img" aria-label="Timeline of the account's events">
        <div className="absolute top-0 right-0 bottom-5 rounded-sm bg-basecast-brand/10" style={{ left: x(windowStart) }} />
        <span className="absolute top-0.5 right-1.5 text-[10px] font-medium text-basecast-brand">Last 12 months</span>
        <div className="absolute right-0 bottom-5 left-0 h-px bg-border" />
        {years.map((y) => (
          <span
            key={y}
            className="absolute bottom-0 -translate-x-1/2 text-[10px] text-muted-foreground tabular-nums"
            style={{ left: x(Date.UTC(y, 0, 1)) }}
          >
            {y}
          </span>
        ))}
        {events.map((event, i) => (
          <Tooltip key={`${event.source_ref ?? event.title}-${event.event_date}-${i}`}>
            <TooltipTrigger asChild>
              <span
                tabIndex={0}
                className={cn(
                  "absolute size-2.5 -translate-x-1/2 cursor-help rounded-full border-2",
                  event.strength === "strong"
                    ? "top-5 border-basecast-brand bg-basecast-brand"
                    : "top-10 border-muted-foreground/60 bg-card",
                )}
                style={{ left: x(utc(event.event_date)) }}
              />
            </TooltipTrigger>
            <TooltipContent className="max-w-xs text-xs">
              <p className="font-medium">{event.title}</p>
              <p className="text-muted-foreground">
                {label("trigger", event.trigger)} · {formatDate(event.event_date)} · {eventPlace(event)}
              </p>
            </TooltipContent>
          </Tooltip>
        ))}
      </div>
      <p className="flex gap-4 text-[11px] text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-basecast-brand" /> Strong
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-2 rounded-full border-2 border-muted-foreground/60" /> Context
        </span>
      </p>
    </div>
  );
}

/** One event: date and age, trigger, title and detail, place and source, and the offer angle it suggests. */
function EventRow({ event }: { event: AccountEvent }) {
  return (
    <li className="space-y-1 border-b border-border py-3 last:border-0">
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <span className="font-medium text-foreground tabular-nums">{formatDate(event.event_date)}</span>
        <span>{formatWhole(event.age_days)} days ago</span>
        <CodeBadge kind="trigger" code={event.trigger} state={event.strength === "strong" ? "active" : "meta"} />
      </div>
      <p className="text-sm font-medium">{event.title}</p>
      {event.detail && <p className="text-sm text-muted-foreground">{event.detail}</p>}
      <p className="text-xs text-muted-foreground">
        {eventPlace(event)} · {event.source}
        {event.source_ref && <span className="font-mono"> · {event.source_ref}</span>}
      </p>
      {event.offer && <p className="text-xs text-foreground/80 italic">Offer angle: {event.offer}</p>}
    </li>
  );
}

const historyParsers = {
  history: parseAsBoolean.withDefault(false),
  events: parseAsInteger.withDefault(0),
};

/** Every event of the account, newest first, a page at a time (`/accounts/{id}/events`). */
function FullHistory({ id, total }: { id: string; total: number }) {
  const { label } = useCodeLabels();
  const [{ events: offset }, setState] = useQueryStates(historyParsers);
  const page = useProductQuery<EventsPage>(
    `accounts/${encodeURIComponent(id)}/events`,
    { offset, limit: HISTORY_PAGE },
    { keepPrevious: true },
  );
  const items = page.data?.data.items ?? [];
  const count = page.data?.data.total ?? total;
  return (
    <div className="mt-3 overflow-x-auto rounded-md border border-border">
      {page.isPending ? (
        <Skeleton className="h-40 w-full" />
      ) : (
        <table className="w-full text-xs">
          <thead className="bg-muted/50 text-left text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-medium">Date</th>
              <th className="px-3 py-2 font-medium">Trigger</th>
              <th className="px-3 py-2 font-medium">Event</th>
              <th className="px-3 py-2 font-medium">Where</th>
              <th className="px-3 py-2 font-medium">Source</th>
            </tr>
          </thead>
          <tbody>
            {items.map((event, i) => (
              <tr key={`${event.source_ref ?? event.title}-${i}`} className="border-t border-border align-top">
                <td className="px-3 py-2 whitespace-nowrap tabular-nums">
                  {formatDate(event.event_date)}
                  {event.active && (
                    <AppBadge state="active" className="ml-1.5">
                      Active
                    </AppBadge>
                  )}
                </td>
                <td className="px-3 py-2">
                  {label("trigger", event.trigger)}
                  <span className="text-muted-foreground"> · {event.strength}</span>
                </td>
                <td className="px-3 py-2">{event.title}</td>
                <td className="px-3 py-2 whitespace-nowrap">{eventPlace(event)}</td>
                <td className="px-3 py-2">
                  {event.source}
                  {event.source_ref && <span className="block font-mono text-muted-foreground">{event.source_ref}</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <div className="flex items-center justify-between border-t border-border px-3 py-2 text-xs text-muted-foreground">
        <span>
          {count ? `${formatWhole(offset + 1)}–${formatWhole(Math.min(offset + HISTORY_PAGE, count))} of ${formatWhole(count)}` : "No events"}
        </span>
        <span className="flex gap-1">
          <Button
            variant="outline"
            size="sm"
            className="h-7 px-2"
            disabled={offset === 0}
            onClick={() => void setState({ events: Math.max(0, offset - HISTORY_PAGE) || null })}
            aria-label="Newer events"
          >
            <ChevronLeft />
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-7 px-2"
            disabled={offset + HISTORY_PAGE >= count}
            onClick={() => void setState({ events: offset + HISTORY_PAGE })}
            aria-label="Older events"
          >
            <ChevronRight />
          </Button>
        </span>
      </div>
    </div>
  );
}

/** Why now: the timeline, the active strong events, the context triggers in one line each, and the full history. */
export function WhyNowCard({
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
  const { label } = useCodeLabels();
  const [{ history }, setState] = useQueryStates(historyParsers);
  const timeline = useProductQuery<EventsPage>(
    `accounts/${encodeURIComponent(account.account_id)}/events`,
    { limit: TIMELINE_LIMIT },
    { throwOnError: false },
  );
  const { active, context_summary: context, history_count: historyCount } = account.triggers;

  return (
    <SectionCard
      title="Why now"
      subtitle={`${formatWhole(active.length)} active strong ${active.length === 1 ? "event" : "events"} · ${formatWhole(historyCount)} ever`}
      caveats={caveats}
      meta={meta}
      className={className}
    >
      {timeline.data ? (
        <EventTimeline events={timeline.data.data.items} asOf={account.as_of} />
      ) : (
        timeline.isPending && <Skeleton className="h-20 w-full" />
      )}
      {active.length > 0 ? (
        <ul className="mt-2">
          {active.map((event, i) => (
            <EventRow key={`${event.source_ref ?? event.title}-${i}`} event={event} />
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-sm text-muted-foreground">No strong event in the last 12 months.</p>
      )}
      {context.length > 0 && (
        <div className="mt-3 space-y-1.5">
          <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">Context</p>
          {context.map((line) => (
            <p key={line.trigger} className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <CodeBadge kind="trigger" code={line.trigger} state="meta" />
              <span>
                ×{formatWhole(line.count)} · latest {formatDate(line.latest_date)}
                {line.counties?.length ? ` · ${line.counties.join(", ")}` : ""}
              </span>
              <span className="sr-only">{label("trigger", line.trigger)}</span>
            </p>
          ))}
        </div>
      )}
      {historyCount > 0 && (
        <div className="mt-4">
          <Button
            variant="outline"
            size="sm"
            className="gap-2 text-xs"
            onClick={() => void setState({ history: history ? null : true, events: null })}
          >
            <History aria-hidden />
            {history ? "Hide the full history" : `Show full history (${formatWhole(historyCount)} events)`}
          </Button>
          {history && <FullHistory id={account.account_id} total={historyCount} />}
        </div>
      )}
    </SectionCard>
  );
}
