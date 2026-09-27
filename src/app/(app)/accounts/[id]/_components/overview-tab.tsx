"use client";

import { ArrowRight, CalendarClock, Clock, Megaphone, Radar } from "lucide-react";
import Link from "next/link";

import { DashboardStatCard } from "@/components/product/dashboard-stat-card";
import { formatDate, formatWhole, GAP } from "@/components/product/format";
import { SectionCard } from "@/components/product/section-card";
import { type AccountDetail, useCodeLabels } from "@/lib/accounts/labels";

import { ACTION_ICON, CodeBadge } from "../../_components/account-bits";

/** A link to another tab of the same account. */
function TabLink({ id, tab, children }: { id: string; tab: string; children: React.ReactNode }) {
  return (
    <Link
      href={`/accounts/${encodeURIComponent(id)}?tab=${tab}`}
      className="inline-flex items-center gap-1 text-xs font-medium text-basecast-brand hover:underline"
    >
      {children}
      <ArrowRight className="size-3" aria-hidden />
    </Link>
  );
}

/** The four numbers of the call: the action, until when it holds, the lead trigger and the active events. */
function CallStats({ account }: { account: AccountDetail }) {
  const { label } = useCodeLabels();
  const next = account.next_action;
  const lead = next.lead_trigger;
  const { score } = account;
  const ActionIcon = ACTION_ICON[next.action];
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <DashboardStatCard
        layout="stacked"
        icon={<ActionIcon className="size-4" aria-hidden />}
        title="Next action"
        value={next.action_label}
        hint={`Tier ${score.tier} · rank ${score.rank} of ${score.n_accounts}`}
      />
      <DashboardStatCard
        layout="stacked"
        icon={<CalendarClock className="size-4" aria-hidden />}
        title="Holds until"
        value={next.changes_on ? formatDate(next.changes_on) : GAP}
        hint={
          next.changes_on
            ? `Unless a new event lands${next.changes_to ? `; then ${label("next_action", next.changes_to)}` : ""}`
            : "No lapse date"
        }
      />
      <DashboardStatCard
        layout="stacked"
        icon={<Radar className="size-4" aria-hidden />}
        title="Lead trigger"
        value={lead ? label("trigger", lead.trigger) : GAP}
        hint={lead ? `${lead.title} · ${formatDate(lead.event_date)}` : "No strong trigger"}
      />
      <DashboardStatCard
        layout="stacked"
        icon={<Clock className="size-4" aria-hidden />}
        title="Active strong events"
        value={formatWhole(account.triggers.active.length)}
        hint={`${formatWhole(account.triggers.history_count)} events in the history`}
      />
    </div>
  );
}

/** What to say: the rule that fired, the offer, and the talking points, numbered. */
function PitchCard({ account, className }: { account: AccountDetail; className?: string }) {
  const next = account.next_action;
  const points = next.talking_points ?? [];
  return (
    <SectionCard title="Pitch" icon={Megaphone} subtitle={next.rule} className={className}>
      <div className="space-y-5">
        {next.offer && (
          <div className="rounded-lg border border-basecast-brand-border bg-basecast-brand-surface px-4 py-3">
            <p className="text-xs font-medium text-basecast-brand">Offer</p>
            <p className="mt-1 text-base font-medium text-foreground">{next.offer}</p>
          </div>
        )}
        {points.length > 0 && (
          <div>
            <p className="mb-3 text-xs font-medium text-muted-foreground">Talking points</p>
            <ol className="space-y-3">
              {points.map((point, i) => (
                <li key={point} className="flex gap-3 text-sm">
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground tabular-nums">
                    {i + 1}
                  </span>
                  <span className="pt-0.5">{point}</span>
                </li>
              ))}
            </ol>
          </div>
        )}
        {!next.offer && points.length === 0 && <p className="text-sm text-muted-foreground">No offer or talking point for this action.</p>}
      </div>
    </SectionCard>
  );
}

/** The event behind the action, with its source; the full list is one tab away. */
function LeadTriggerCard({ account }: { account: AccountDetail }) {
  const lead = account.next_action.lead_trigger;
  return (
    <SectionCard title="Lead trigger" icon={Radar} action={<TabLink id={account.account_id} tab="why-now">Why now</TabLink>}>
      {lead ? (
        <div className="space-y-2">
          <CodeBadge kind="trigger" code={lead.trigger} state="active" />
          <p className="text-base font-medium">{lead.title}</p>
          <p className="text-xs text-muted-foreground">
            {formatDate(lead.event_date)} · {lead.source}
            {lead.source_ref && <span className="font-mono"> · {lead.source_ref}</span>}
          </p>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">No strong trigger behind this action.</p>
      )}
    </SectionCard>
  );
}

const LATEST_SHOWN = 3;

/** The freshest active strong events, as the API orders them. */
function LatestEventsCard({ account }: { account: AccountDetail }) {
  const { active } = account.triggers;
  return (
    <SectionCard
      title="Latest strong events"
      icon={Clock}
      action={
        active.length > LATEST_SHOWN && (
          <TabLink id={account.account_id} tab="why-now">
            All {formatWhole(active.length)}
          </TabLink>
        )
      }
    >
      {active.length ? (
        <ul className="divide-y divide-border">
          {active.slice(0, LATEST_SHOWN).map((event, i) => (
            <li key={`${event.source_ref ?? event.title}-${i}`} className="space-y-1 py-2.5 first:pt-0 last:pb-0">
              <p className="text-xs text-muted-foreground tabular-nums">
                {formatDate(event.event_date)} · {formatWhole(event.age_days)} days ago
              </p>
              <p className="text-sm font-medium">{event.title}</p>
              <CodeBadge kind="trigger" code={event.trigger} state="meta" />
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">No strong event in the last 12 months.</p>
      )}
    </SectionCard>
  );
}

/** Overview: the call in four numbers, the pitch, and the lead trigger with the latest events beside it. */
export function OverviewTab({ account }: { account: AccountDetail }) {
  return (
    <div className="space-y-4">
      <CallStats account={account} />
      <div className="grid gap-4 lg:grid-cols-3 lg:items-start">
        <PitchCard account={account} className="lg:col-span-2" />
        <div className="space-y-4">
          <LeadTriggerCard account={account} />
          <LatestEventsCard account={account} />
        </div>
      </div>
    </div>
  );
}
