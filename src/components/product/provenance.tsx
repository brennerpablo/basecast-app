"use client";

import { formatDateTime } from "@/components/data-browser/format";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { Meta } from "@/lib/bff/envelope";
import { cn } from "@/lib/utils";

import { formatDate, GAP } from "./format";

/**
 * A data view's footer: the data date on one muted line, the sources, model version and generation time in its
 * tooltip. A screen shows it once, at its foot; cards that share the screen's response leave it out.
 */
export function Provenance({ meta, className }: { meta: Meta; className?: string }) {
  const asOf = formatDate(meta.data_as_of);
  const details: { label: string; value: string; mono?: boolean }[] = [
    { label: "Source", value: meta.sources?.length ? meta.sources.join(", ") : GAP },
    { label: "Data as of", value: asOf },
  ];
  if (meta.model_version) details.push({ label: "Model", value: meta.model_version, mono: true });
  details.push({ label: "Generated", value: formatDateTime(meta.generated_at) });
  return (
    <div data-slot="provenance" className={cn("flex text-xs text-muted-foreground", className)}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            tabIndex={0}
            aria-label={details.map((d) => `${d.label}: ${d.value}`).join(" · ")}
            className="cursor-help underline decoration-dotted decoration-muted-foreground/40 underline-offset-2"
          >
            As of {asOf}
          </span>
        </TooltipTrigger>
        <TooltipContent className="text-xs">
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5">
            {details.map((d) => (
              <div key={d.label} className="contents">
                <dt className="text-muted-foreground">{d.label}</dt>
                <dd className={cn(d.mono && "font-mono")}>{d.value}</dd>
              </div>
            ))}
          </dl>
        </TooltipContent>
      </Tooltip>
    </div>
  );
}
