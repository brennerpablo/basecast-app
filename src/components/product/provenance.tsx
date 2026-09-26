import { formatDateTime } from "@/components/data-browser/format";
import type { Meta } from "@/lib/bff/envelope";
import { cn } from "@/lib/utils";

import { formatDate, GAP } from "./format";

/** A data card's footer: the response's sources, data date and model version. */
export function Provenance({ meta, className }: { meta: Meta; className?: string }) {
  const parts: { label: string; value: string; mono?: boolean }[] = [
    { label: "Source", value: meta.sources.length ? meta.sources.join(", ") : GAP },
    { label: "Data as of", value: formatDate(meta.data_as_of) },
  ];
  if (meta.model_version) parts.push({ label: "Model", value: meta.model_version, mono: true });
  return (
    <p
      data-slot="provenance"
      title={`Generated ${formatDateTime(meta.generated_at)}`}
      className={cn("flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground", className)}
    >
      {parts.map((part) => (
        <span key={part.label}>
          <span className="text-muted-foreground/70">{part.label}:</span>{" "}
          <span className={cn("text-foreground/80", part.mono && "font-mono")}>{part.value}</span>
        </span>
      ))}
    </p>
  );
}
