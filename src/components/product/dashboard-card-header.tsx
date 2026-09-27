import { ExternalLink } from "lucide-react";
import Link from "next/link";
import type * as React from "react";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

/**
 * A dashboard card's header, as Fundsys's `DashboardChartCard` (`tile` variant): the icon in a grey square
 * (48 px, 40 on a phone as its `DashboardStatCard`), the title with a grey line under it, and whatever sits on
 * the right (badges, the open link).
 */
export function DashboardCardHeader({
  icon,
  title,
  subtitle,
  trailing,
  className,
}: {
  icon: React.ReactNode;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  trailing?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex w-full items-start gap-3", className)}>
      <div className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-border bg-muted text-foreground sm:size-12">
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <h3 className="text-base font-medium text-foreground">{title}</h3>
        {subtitle && <p className="mt-0.5 text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      {trailing && <div className="flex shrink-0 items-center gap-1.5">{trailing}</div>}
    </div>
  );
}

/**
 * The card's link to the screen behind it: an icon button named by `label`, as Fundsys's
 * `ChartCardExternalLink`, but in the header's flow instead of pinned to the corner.
 */
export function CardOpenLink({ href, label }: { href: string; label: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Link
          href={href}
          aria-label={label}
          className="flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <ExternalLink className="size-3.5" aria-hidden />
        </Link>
      </TooltipTrigger>
      <TooltipContent className="text-xs">{label}</TooltipContent>
    </Tooltip>
  );
}
