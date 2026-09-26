"use client";

import type { ElementType, KeyboardEvent, ReactNode } from "react";
import { useMemo, useRef } from "react";

import { cn } from "@/lib/utils";

type ViewSwitchSize = "icon" | "sm" | "xs";

export type ViewSwitchOption<TValue extends string> = {
  value: TValue;
  label: ReactNode;
  ariaLabel?: string;
  title?: string;
  disabled?: boolean;
  className?: string;
  icon?: ElementType<{ className?: string; "aria-hidden"?: boolean }>;
};

export interface ViewSwitchControlProps<TValue extends string> {
  value: TValue;
  options: readonly ViewSwitchOption<TValue>[];
  onValueChange: (value: TValue) => void;
  ariaLabel: string;
  size?: ViewSwitchSize;
  className?: string;
  itemClassName?: string;
}

const itemSizeClasses: Record<ViewSwitchSize, string> = {
  icon: "size-7",
  sm: "h-7 px-2.5 text-xs",
  xs: "h-6 px-2 text-[10px]",
};

const iconSizeClasses: Record<ViewSwitchSize, string> = {
  icon: "size-4",
  sm: "size-3.5",
  xs: "size-3",
};

export function ViewSwitchControl<TValue extends string>({
  value,
  options,
  onValueChange,
  ariaLabel,
  size = "icon",
  className,
  itemClassName,
}: ViewSwitchControlProps<TValue>) {
  const buttonRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  const enabledOptions = useMemo(
    () => options.filter((option) => !option.disabled),
    [options],
  );

  function focusOption(nextValue: TValue) {
    window.requestAnimationFrame(() => {
      buttonRefs.current[nextValue]?.focus();
    });
  }

  function selectOption(nextValue: TValue) {
    if (nextValue === value) return;
    onValueChange(nextValue);
    focusOption(nextValue);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (enabledOptions.length === 0) return;

    const currentIndex = enabledOptions.findIndex((option) => option.value === value);
    const fallbackIndex = currentIndex >= 0 ? currentIndex : 0;
    let nextIndex: number | null = null;

    if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      nextIndex = (fallbackIndex + 1) % enabledOptions.length;
    } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      nextIndex = (fallbackIndex - 1 + enabledOptions.length) % enabledOptions.length;
    } else if (event.key === "Home") {
      nextIndex = 0;
    } else if (event.key === "End") {
      nextIndex = enabledOptions.length - 1;
    }

    if (nextIndex == null) return;

    event.preventDefault();
    selectOption(enabledOptions[nextIndex].value);
  }

  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      onKeyDown={handleKeyDown}
      className={cn("inline-flex items-center rounded-md border bg-background p-0.5", className)}
    >
      {options.map((option) => {
        const Icon = option.icon;
        const selected = option.value === value;
        const showLabel = size !== "icon";
        return (
          <button
            key={option.value}
            ref={(node) => {
              buttonRefs.current[option.value] = node;
            }}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={option.ariaLabel}
            title={option.title}
            disabled={option.disabled}
            tabIndex={selected || (!enabledOptions.some((item) => item.value === value) && option === enabledOptions[0]) ? 0 : -1}
            onClick={() => selectOption(option.value)}
            className={cn(
              "inline-flex items-center justify-center gap-1.5 rounded font-medium outline-none transition-colors",
              "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
              itemSizeClasses[size],
              selected
                ? "bg-basecast-brand-100 text-basecast-brand-700"
                : "text-muted-foreground hover:bg-accent hover:text-foreground",
              option.disabled && "cursor-not-allowed opacity-40 hover:bg-transparent hover:text-muted-foreground",
              itemClassName,
              option.className,
            )}
          >
            {Icon && <Icon className={iconSizeClasses[size]} aria-hidden />}
            <span className={cn(!showLabel && "sr-only")}>{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}
