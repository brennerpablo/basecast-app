import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * The app's canonical empty state, and **the only component for it**.
 *
 * A centered card: icon, title and optional description. Short inline texts
 * (a combobox, an empty DataTable row, a chart placeholder) are **not** empty
 * states and do not go through here.
 *
 * `Icon` is required on purpose: each context picks its glyph. The default
 * color is dark slate; pass `iconClassName` to change it (e.g. `text-brand`).
 *
 * **Punctuation (fixed rule):** `title` has **no** final period,
 * `description` **has** one. The title is a label; the description is a
 * sentence.
 */
export interface EmptyStateProps {
  /** Lucide glyph. Required: pick one that describes what is missing. */
  Icon: LucideIcon;
  title: string;
  description?: string;
  /** Icon color/size. Default: dark slate. E.g. `"text-brand"`. */
  iconClassName?: string;
  /** Smaller padding and icon, for small panels inside a card. */
  compact?: boolean;
  className?: string;
}

const EmptyState = ({
  Icon,
  title,
  description,
  iconClassName,
  compact = false,
  className,
}: EmptyStateProps) => {
  return (
    <div
      className={cn(
        "flex w-full flex-col items-center justify-center rounded-lg border border-border bg-card px-6 text-center shadow-xs",
        compact ? "py-8" : "py-12",
        className,
      )}
    >
      <Icon
        className={cn(
          "mb-3 text-slate-700 dark:text-slate-300",
          compact ? "size-8" : "size-10",
          iconClassName,
        )}
        aria-hidden
      />
      <p className={cn("font-medium text-foreground", compact ? "text-sm" : "text-base")}>
        {title}
      </p>
      {description ? (
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      ) : null}
    </div>
  );
};

export default EmptyState;
