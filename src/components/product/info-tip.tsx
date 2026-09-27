"use client";

import { Info } from "lucide-react";
import type * as React from "react";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

/**
 * An info icon whose tooltip holds what a screen would otherwise print as a line of text: a definition, how a
 * value is built, a caveat that belongs to one card. The screen shows the data; the explanation waits for a hover.
 */
export function InfoTip({ children, label = "About this", className }: { children: React.ReactNode; label?: string; className?: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label={label}
          data-slot="info-tip"
          className={cn(
            "inline-flex size-4 shrink-0 cursor-help items-center justify-center rounded-sm text-muted-foreground/70 transition-colors hover:text-foreground",
            className,
          )}
        >
          <Info className="size-3.5" aria-hidden />
        </button>
      </TooltipTrigger>
      <TooltipContent className="max-w-xs text-xs">{children}</TooltipContent>
    </Tooltip>
  );
}
