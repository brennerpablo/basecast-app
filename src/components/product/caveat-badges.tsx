"use client";

import { FlaskConical, Info, type LucideIcon, ScanEye } from "lucide-react";

import { AppBadge, type AppBadgeState } from "@/components/components-app/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { Caveat, CaveatCode } from "@/lib/bff/envelope";
import { useCaveatCatalog } from "@/lib/bff/queries";
import { cn } from "@/lib/utils";

/** How a caveat looks: machine-read values in amber, simulated or invented ones dashed, the rest as metadata. */
const LOOK: Partial<Record<CaveatCode, { state: AppBadgeState; Icon: LucideIcon }>> = {
  machine_read_unverified: { state: "alert", Icon: ScanEye },
  simulated: { state: "draft", Icon: FlaskConical },
  fixture: { state: "draft", Icon: FlaskConical },
};
const DEFAULT_LOOK = { state: "metadata" as const, Icon: Info };

/**
 * One caveat: its label on the badge, the contract's text in the tooltip. `compact` draws the icon alone, for a
 * badge repeated on every row of a table; the label moves into the tooltip.
 */
export function CaveatBadge({ caveat, compact, className }: { caveat: Caveat; compact?: boolean; className?: string }) {
  const { state, Icon } = LOOK[caveat.code] ?? DEFAULT_LOOK;
  const hasTip = compact || !!caveat.text;
  const badge = (
    <AppBadge
      state={state}
      data-caveat={caveat.code}
      aria-label={compact ? caveat.label : undefined}
      tabIndex={hasTip ? 0 : undefined}
      className={cn("gap-1", hasTip && "cursor-help", compact && "px-1", className)}
    >
      <Icon aria-hidden />
      {!compact && caveat.label}
    </AppBadge>
  );
  if (!hasTip) return badge;
  return (
    <Tooltip>
      <TooltipTrigger asChild>{badge}</TooltipTrigger>
      <TooltipContent className="max-w-xs text-xs">
        {compact && <p className="font-medium">{caveat.label}</p>}
        {caveat.text}
      </TooltipContent>
    </Tooltip>
  );
}

/** A response's `meta.caveats` as badges. The app never writes a caveat of its own. */
export function CaveatBadges({ caveats, className }: { caveats: Caveat[] | null | undefined; className?: string }) {
  if (!caveats?.length) return null;
  return (
    <div className={cn("flex flex-wrap gap-1.5", className)}>
      {caveats.map((caveat) => (
        <CaveatBadge key={caveat.code} caveat={caveat} />
      ))}
    </div>
  );
}

const fromCode = (code: CaveatCode) => code.charAt(0).toUpperCase() + code.slice(1).replaceAll("_", " ");

/** A caveat of the `GET /caveats` catalog by code. Until the catalog answers, the badge reads the code. */
function CatalogBadge({ code, compact }: { code: CaveatCode; compact?: boolean }) {
  const catalog = useCaveatCatalog();
  return <CaveatBadge compact={compact} caveat={catalog.data?.get(code) ?? { code, label: fromCode(code), text: "" }} />;
}

/**
 * "Machine-read, not verified" beside a value whose `verified` is false; nothing otherwise. `compact` (a table
 * row) draws the icon alone.
 */
export function VerifiedBadge({ verified, compact }: { verified: boolean | null | undefined; compact?: boolean }) {
  return verified === false ? <CatalogBadge code="machine_read_unverified" compact={compact} /> : null;
}

/** "Simulated" beside a value from a simulated private-data adapter or a fixture; nothing otherwise. */
export function SimulatedBadge({ simulated = true }: { simulated?: boolean | null }) {
  return simulated ? <CatalogBadge code="simulated" /> : null;
}
