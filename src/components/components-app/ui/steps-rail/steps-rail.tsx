"use client";

import { Check } from "lucide-react";

import { cn } from "@/lib/utils";

export interface StepsRailStep {
  id: string;
  label: string;
  description?: string;
}

export type StepsRailProgressMode = "linear" | "explicit";

export interface StepsRailProps {
  steps: StepsRailStep[];
  activeIndex: number;
  onSelect: (index: number) => void;
  /**
   * - `linear` (default): check só em etapas **atrás** da atual (`index < active`).
   *   Prefill em etapas futuras não mostra check (wizard Ações/Revisão).
   * - `explicit`: check quando `completed[i]` e a etapa não é a ativa
   *   (Processos — conclusão manual).
   */
  progressMode?: StepsRailProgressMode;
  /** Usado em `progressMode="explicit"`. Em `linear` é ignorado. */
  completed?: boolean[];
  disabledIndices?: number[];
  disabled?: boolean;
  className?: string;
}

/**
 * Rail vertical de etapas (Ações / Processos / sheets em etapas).
 * Tokens: `brand` para atual e concluída — nunca `primary`/`foreground` (quase preto).
 */
export function StepsRail({
  steps,
  activeIndex,
  onSelect,
  progressMode = "linear",
  completed = [],
  disabledIndices = [],
  disabled = false,
  className,
}: StepsRailProps) {
  const disabledSet = new Set(disabledIndices);

  return (
    <div className={cn("flex w-full flex-col pt-4", className)}>
      {steps.map((step, idx) => {
        const isActive = idx === activeIndex;
        const isDone =
          progressMode === "linear"
            ? idx < activeIndex
            : Boolean(completed[idx]) && !isActive;
        const isLast = idx === steps.length - 1;
        const isDisabled = disabled || disabledSet.has(idx);

        return (
          <button
            key={step.id}
            type="button"
            disabled={isDisabled}
            onClick={() => onSelect(idx)}
            aria-current={isActive ? "step" : undefined}
            className={cn(
              "group relative flex w-full gap-3 px-4 text-left select-none",
              isDisabled ? "cursor-not-allowed opacity-50" : "cursor-pointer",
            )}
          >
            <div className="flex shrink-0 flex-col items-center">
              {isDone ? (
                <div className="flex size-7 items-center justify-center rounded-full bg-brand transition-colors group-hover:bg-brand-hover">
                  <Check className="size-3.5 text-brand-foreground" strokeWidth={2.5} />
                </div>
              ) : isActive ? (
                <div className="flex size-7 items-center justify-center rounded-full border-2 border-brand bg-card">
                  <span className="text-[10px] font-semibold tabular-nums text-brand">
                    {idx + 1}
                  </span>
                </div>
              ) : (
                <div className="flex size-7 items-center justify-center rounded-full border-2 border-muted-foreground/25 bg-card transition-colors group-hover:border-muted-foreground/50">
                  <span className="text-[10px] tabular-nums text-muted-foreground/60">
                    {idx + 1}
                  </span>
                </div>
              )}

              {!isLast && (
                <div className="my-1 min-h-6 w-0.5 flex-1">
                  <div
                    className={cn(
                      "size-full",
                      isDone ? "bg-brand" : "bg-muted-foreground/20",
                    )}
                  />
                </div>
              )}
            </div>

            <div className={cn("min-w-0 flex-1 pt-0.5", isLast ? "pb-2" : "pb-4")}>
              <span
                className={cn(
                  "block text-sm font-medium leading-snug",
                  isActive ? "text-foreground" : "text-muted-foreground",
                )}
              >
                {step.label}
              </span>
              {step.description ? (
                <span className="mt-0.5 block text-xs text-muted-foreground/60">
                  {step.description}
                </span>
              ) : null}
            </div>
          </button>
        );
      })}
    </div>
  );
}
