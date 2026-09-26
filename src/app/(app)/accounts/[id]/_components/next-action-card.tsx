"use client";

import { CalendarClock } from "lucide-react";

import { formatDate } from "@/components/product/format";
import { SectionCard } from "@/components/product/section-card";
import { type AccountDetail, useCodeLabels } from "@/lib/accounts/labels";
import type { Meta } from "@/lib/bff/envelope";

import { NextActionBadge } from "../../_components/account-bits";

function Block({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">{label}</p>
      <div className="text-sm">{children}</div>
    </div>
  );
}

/** The action, the rule that fired in words, the lead trigger, the offer and the day the action lapses. */
export function NextActionCard({ account, meta, className }: { account: AccountDetail; meta: Meta; className?: string }) {
  const { label } = useCodeLabels();
  const next = account.next_action;
  const lead = next.lead_trigger;
  const points = next.talking_points ?? [];
  return (
    <SectionCard title="Next action" meta={meta} className={className}>
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <NextActionBadge action={next.action} />
          <span className="text-sm text-muted-foreground">{next.rule}</span>
        </div>
        {next.changes_on && (
          <p className="flex items-start gap-2 rounded-md border border-yellow-600/30 bg-yellow-50 px-3 py-2 text-sm text-yellow-950 dark:border-yellow-800/45 dark:bg-yellow-950/30 dark:text-yellow-100">
            <CalendarClock className="mt-0.5 size-4 shrink-0" aria-hidden />
            <span>
              {next.action_label} until <strong>{formatDate(next.changes_on)}</strong> unless a new event lands
              {next.changes_to ? `, then ${label("next_action", next.changes_to)}` : ""}.
            </span>
          </p>
        )}
        {lead && (
          <Block label="Lead trigger">
            <p className="font-medium">{lead.title}</p>
            <p className="text-xs text-muted-foreground">
              {label("trigger", lead.trigger)} · {formatDate(lead.event_date)} · {lead.source}
              {lead.source_ref && <span className="font-mono"> · {lead.source_ref}</span>}
            </p>
          </Block>
        )}
        {next.offer && <Block label="Offer">{next.offer}</Block>}
        {points.length > 0 && (
          <Block label="Talking points">
            <ul className="list-disc space-y-1 pl-4">
              {points.map((point) => (
                <li key={point}>{point}</li>
              ))}
            </ul>
          </Block>
        )}
      </div>
    </SectionCard>
  );
}
