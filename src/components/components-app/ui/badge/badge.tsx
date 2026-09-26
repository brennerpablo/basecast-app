import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

const activeVariantClasses =
  "h-5 ring-0 border border-emerald-600/30 bg-teal-50 text-teal-800 dark:border-emerald-400/30 dark:bg-teal-950/40 dark:text-teal-300";
const mutedVariantClasses =
  "h-5 ring-0 border border-slate-200 bg-slate-50/70 text-slate-400 dark:border-slate-700 dark:bg-slate-900/25 dark:text-slate-500";
const processingVariantClasses =
  "h-5 ring-0 border border-sky-200 bg-sky-50 text-sky-800 dark:border-sky-800/60 dark:bg-sky-950/40 dark:text-sky-300";
const criticalVariantClasses =
  "h-5 ring-0 border border-red-300 bg-red-50 text-red-800 dark:border-red-700/70 dark:bg-red-950/50 dark:text-red-300";
const severeVariantClasses =
  "h-5 ring-0 border border-orange-600/35 bg-orange-100 text-red-900 dark:border-orange-600/50 dark:bg-orange-950/45 dark:text-orange-200";
const metadataVariantClasses =
  "h-5 ring-0 border border-zinc-200 bg-zinc-50 text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900/50 dark:text-zinc-300";
const draftVariantClasses =
  "h-5 ring-0 border border-dashed border-stone-300 bg-stone-50 text-stone-600 dark:border-stone-600 dark:bg-stone-900/30 dark:text-stone-300";
const metaVariantClasses =
  "h-5 ring-0 border border-slate-200 bg-slate-50 text-slate-500 dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-300";

/** Semantic core variants (soft fill + border). */
const defaultCoreClasses =
  "h-5 ring-0 border border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800/60 dark:bg-blue-950/40 dark:text-blue-300";
const neutralCoreClasses = metaVariantClasses;
const successCoreClasses =
  "h-5 ring-0 border border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800/60 dark:bg-emerald-950/40 dark:text-emerald-300";
const warningCoreClasses =
  "h-5 ring-0 border border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800/60 dark:bg-amber-950/40 dark:text-amber-300";
/** Alert / pending: burnt yellow (distinct from the orange `severe`). */
const alertVariantClasses =
  "h-5 ring-0 border border-yellow-600/40 bg-yellow-50 text-yellow-900 dark:border-yellow-800/45 dark:bg-yellow-950/35 dark:text-yellow-200";
const errorCoreClasses =
  "h-5 ring-0 border border-red-200 bg-red-50 text-red-700 dark:border-red-800/60 dark:bg-red-950/40 dark:text-red-300";

/** Legacy ring-inset look (`legacy*`). Prefer the core variants. */
const legacyDefaultClasses =
  "bg-blue-50 text-blue-900 ring-blue-500/30 dark:bg-blue-400/10 dark:text-blue-400 dark:ring-blue-400/30";
const legacyNeutralClasses =
  "bg-gray-50 text-gray-900 ring-gray-500/30 dark:bg-gray-400/10 dark:text-gray-400 dark:ring-gray-400/20";
const legacySuccessClasses =
  "bg-emerald-50 text-emerald-900 ring-emerald-600/30 dark:bg-emerald-400/10 dark:text-emerald-400 dark:ring-emerald-400/20";
const legacyErrorClasses =
  "bg-red-50 text-red-900 ring-red-600/20 dark:bg-red-400/10 dark:text-red-400 dark:ring-red-400/20";
const legacyWarningClasses =
  "bg-yellow-50 text-yellow-900 ring-yellow-600/30 dark:bg-yellow-400/10 dark:text-yellow-500 dark:ring-yellow-400/20";

const METRIC_VARIANTS = [
  "default",
  "neutral",
  "success",
  "warning",
  "alert",
  "error",
  "active",
  "muted",
  "processing",
  "critical",
  "severe",
  "metadata",
  "draft",
  "meta",
] as const;

const badgeVariants = cva(
  "inline-flex items-center gap-x-1 rounded-md font-medium w-fit whitespace-nowrap shrink-0 ring-1 ring-inset transition-colors",
  {
    variants: {
      variant: {
        /** Core: border + compact metric. */
        default: defaultCoreClasses,
        neutral: neutralCoreClasses,
        success: successCoreClasses,
        error: errorCoreClasses,
        warning: warningCoreClasses,
        alert: alertVariantClasses,
        /** @deprecated Ring-inset look. Prefer `success`, `neutral`, etc. */
        legacyDefault: legacyDefaultClasses,
        legacyNeutral: legacyNeutralClasses,
        legacySuccess: legacySuccessClasses,
        legacyError: legacyErrorClasses,
        legacyWarning: legacyWarningClasses,
        /** Product state variants (border + h-5 metric). */
        active: activeVariantClasses,
        muted: mutedVariantClasses,
        processing: processingVariantClasses,
        critical: criticalVariantClasses,
        severe: severeVariantClasses,
        metadata: metadataVariantClasses,
        draft: draftVariantClasses,
        meta: metaVariantClasses,
      },
      size: {
        sm: "px-1.5 py-0.5 text-xs [&>svg]:size-3",
        md: "px-2 py-1 text-xs [&>svg]:size-3",
        lg: "px-2.5 py-1 text-sm [&>svg]:size-3.5",
      },
    },
    compoundVariants: [
      {
        variant: [...METRIC_VARIANTS],
        size: "sm",
        class: "px-1.5 py-0 text-[11px] [&>svg]:size-3",
      },
      {
        variant: [...METRIC_VARIANTS],
        size: "md",
        class: "px-1.5 py-0 text-[11px] [&>svg]:size-3",
      },
      {
        variant: [...METRIC_VARIANTS],
        size: "lg",
        class: "px-2 py-0 text-xs [&>svg]:size-3.5",
      },
    ],
    defaultVariants: {
      variant: "default",
      size: "sm",
    },
  },
);

type BadgeProps = React.ComponentPropsWithoutRef<"span"> &
  VariantProps<typeof badgeVariants> & {
    tooltip?: boolean;
  };

function Badge({ className, variant, size, tooltip, children, ...props }: BadgeProps) {
  const badge = (
    <span
      data-slot="badge"
      className={cn(badgeVariants({ variant, size }), className)}
      {...props}
    >
      {children}
    </span>
  );

  if (!tooltip) return badge;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>{badge}</TooltipTrigger>
        <TooltipContent>{children}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export { Badge, badgeVariants };
export type { BadgeProps };
