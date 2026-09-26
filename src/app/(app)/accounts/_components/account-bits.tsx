"use client";

import { FileText, Flag, type LucideIcon, MapPinOff, Scale, Unplug } from "lucide-react";

import { AppBadge, type AppBadgeState } from "@/components/components-app/ui/badge";
import { formatDate, GAP } from "@/components/product/format";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { type AccountFlag, type AccountSummary, codeLabel, type NextAction } from "@/lib/accounts/labels";
import { cn } from "@/lib/utils";

/** One color per next action: call now in the product's green, nurture blue, watch amber, hold muted. */
const ACTION_STATE: Record<NextAction, AppBadgeState> = {
  call_now: "active",
  nurture: "info",
  watch: "alert",
  hold: "inactive",
};

/** The order next actions sort and list in, most urgent first. */
export const ACTION_ORDER: NextAction[] = ["call_now", "nurture", "watch", "hold"];

export function NextActionBadge({ action }: { action: NextAction }) {
  return <AppBadge state={ACTION_STATE[action] ?? "meta"}>{codeLabel("next_action", action)}</AppBadge>;
}

const days = (n: number) => `${n} ${n === 1 ? "day" : "days"}`;

/** The freshest strong trigger with its age ("dc_permit · 38 days"); the event's title and date in the tooltip. */
export function TopTrigger({ trigger }: { trigger: AccountSummary["top_trigger"] }) {
  if (!trigger) return <span className="text-muted-foreground">{GAP}</span>;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span tabIndex={0} className="cursor-help text-xs whitespace-nowrap">
          {codeLabel("trigger", trigger.trigger)} · {days(trigger.age_days)}
        </span>
      </TooltipTrigger>
      <TooltipContent className="max-w-xs text-xs">
        <p className="font-medium">{trigger.title}</p>
        <p className="text-muted-foreground">{formatDate(trigger.event_date)}</p>
      </TooltipContent>
    </Tooltip>
  );
}

export function TriggerChips({ triggers, className }: { triggers: string[]; className?: string }) {
  if (!triggers.length) return <span className="text-muted-foreground">{GAP}</span>;
  return (
    <span className={cn("flex flex-wrap gap-1", className)}>
      {[...new Set(triggers)].map((trigger) => (
        <AppBadge key={trigger} state="meta">
          {codeLabel("trigger", trigger)}
        </AppBadge>
      ))}
    </span>
  );
}

/** A glyph per data-quality flag; the flag itself names it in the tooltip. */
const FLAG_ICON: Record<AccountFlag, LucideIcon> = {
  no_exposed_county: MapPinOff,
  apportionment_under: Scale,
  apportionment_over: Scale,
  short_form: FileText,
  eia_break: Unplug,
};

export function FlagIcons({ flags }: { flags: AccountFlag[] }) {
  if (!flags.length) return null;
  return (
    <span className="inline-flex items-center gap-1.5 text-muted-foreground">
      {flags.map((flag) => {
        const Icon = FLAG_ICON[flag] ?? Flag;
        const label = codeLabel("flag", flag);
        return (
          <Tooltip key={flag}>
            <TooltipTrigger asChild>
              <span tabIndex={0} aria-label={label} data-flag={flag} className="cursor-help hover:text-foreground">
                <Icon className="size-3.5" aria-hidden />
              </span>
            </TooltipTrigger>
            <TooltipContent className="text-xs">{label}</TooltipContent>
          </Tooltip>
        );
      })}
    </span>
  );
}

/** The score as the API sends it (0–1): a bar on that fixed scale and the value. */
export function ScoreBar({ score }: { score: number }) {
  const width = Math.min(1, Math.max(0, score)) * 100;
  return (
    <span className="flex items-center gap-2">
      <span className="h-1.5 w-16 overflow-hidden rounded-full bg-muted" aria-hidden>
        <span className="block h-full rounded-full bg-basecast-brand" style={{ width: `${width}%` }} />
      </span>
      <span className="text-xs tabular-nums">{score.toFixed(2)}</span>
    </span>
  );
}
