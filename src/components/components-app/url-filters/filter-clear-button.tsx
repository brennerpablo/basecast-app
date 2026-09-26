"use client";

import { X } from "lucide-react";

import { BADGE_METRIC_CLASS } from "@/components/components-app/ui/badge/app-badge-tokens";
import { cn } from "@/lib/utils";

export interface FilterClearButtonProps {
  onClick: () => void;
  /** Rótulo visível. Default: `"Limpar"`. */
  label?: string;
  className?: string;
}

/**
 * Botão compacto para limpar filtros inline (X + texto).
 * Métrica alinhada a {@link BADGE_METRIC_CLASS} / `AppBadge` (h-5 · 11px).
 *
 * Renderizar apenas quando há filtro ativo (`hasActive`).
 */
export function FilterClearButton({
  onClick,
  label = "Clear",
  className,
}: FilterClearButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        BADGE_METRIC_CLASS,
        "inline-flex items-center gap-0.5 rounded-md font-medium",
        "text-muted-foreground transition-colors",
        "hover:bg-muted/80 hover:text-foreground",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
        className,
      )}
    >
      <X className="size-3 shrink-0" aria-hidden />
      {label}
    </button>
  );
}
