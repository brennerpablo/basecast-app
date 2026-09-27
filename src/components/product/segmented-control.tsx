"use client";

import { cn } from "@/lib/utils";

/** A bordered strip of choices, the chosen one in solid foreground (the /ops range toggle). */
export function SegmentedControl<T extends string | number>({
  label,
  options,
  value,
  onChange,
  className,
}: {
  /** The group's accessible name. */
  label: string;
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
}) {
  return (
    <div
      role="group"
      aria-label={label}
      // Scrolls inside itself when its choices outgrow the row, so a narrow screen never scrolls sideways.
      className={cn("inline-flex max-w-full items-center gap-1 overflow-x-auto rounded-md border border-border bg-card p-1", className)}
    >
      {options.map((option) => (
        <button
          key={String(option.value)}
          type="button"
          aria-pressed={value === option.value}
          onClick={() => onChange(option.value)}
          className={cn(
            "shrink-0 rounded px-2.5 py-1 text-xs font-medium whitespace-nowrap transition-colors",
            value === option.value ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground",
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
