import { Slot } from "@radix-ui/react-slot";
import * as React from "react";

import { cn } from "@/lib/utils";

import { type AppBadgeState, resolveAppBadge } from "./app-badge-tokens";
import { Badge, type BadgeProps, badgeVariants } from "./badge";

type AppBadgeProps = Omit<BadgeProps, "variant"> & {
  state: AppBadgeState;
  /** Subtle hover, for clickable metadata. */
  interactive?: boolean;
  asChild?: boolean;
  /** Minimum width for icons and counters (+). */
  square?: boolean;
};

/** The product badge: pick a state, not a color. */
function AppBadge({
  state,
  className,
  interactive = false,
  asChild = false,
  square = false,
  size = "sm",
  children,
  ...props
}: AppBadgeProps) {
  const resolved = resolveAppBadge(state);

  if (resolved.mode === "meta") {
    const Comp = asChild ? Slot : "span";

    return (
      <Comp
        data-slot="app-badge"
        data-state={state}
        className={cn(
          badgeVariants({ variant: "meta", size: "sm" }),
          interactive && "hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200",
          square && "min-w-5 justify-center",
          className,
        )}
        {...props}
      >
        {children}
      </Comp>
    );
  }

  return (
    <Badge
      data-state={state}
      variant={resolved.variant}
      size={size}
      className={className}
      {...props}
    >
      {children}
    </Badge>
  );
}

export { AppBadge };
export type { AppBadgeProps };
