import * as React from "react";

import { AppBadge, type AppBadgeProps } from "./app-badge";
import type { AppBadgeState } from "./app-badge-tokens";

function normalizeHex(color: string): string {
  const c = color.trim();
  if (/^#[0-9a-fA-F]{6}$/.test(c)) return c;
  if (/^[0-9a-fA-F]{6}$/.test(c)) return `#${c}`;
  return c;
}

const COLORED_BADGE_TEXT_DARKEN = 0.35;
/** Background alpha (#RRGGBB + suffix). */
const COLORED_BADGE_BG_ALPHA_HEX = "1f";
const COLORED_BADGE_BORDER_ALPHA_HEX = "66";

/** Darkens a hex color by `amount` (0.35 = 35% darker). */
export function darkenHex(color: string, amount = COLORED_BADGE_TEXT_DARKEN): string {
  const hex = normalizeHex(color).replace("#", "");
  if (hex.length !== 6) return color;

  const channel = (start: number) => parseInt(hex.slice(start, start + 2), 16);
  const darken = (value: number) =>
    Math.max(0, Math.min(255, Math.round(value * (1 - amount))));

  const r = darken(channel(0)).toString(16).padStart(2, "0");
  const g = darken(channel(2)).toString(16).padStart(2, "0");
  const b = darken(channel(4)).toString(16).padStart(2, "0");
  return `#${r}${g}${b}`;
}

/** Inline style for a badge with a configurable hex color. */
export function appColoredBadgeStyle(color: string): React.CSSProperties {
  const c = normalizeHex(color);
  const textColor = darkenHex(c, COLORED_BADGE_TEXT_DARKEN);
  return {
    backgroundColor: `${c}${COLORED_BADGE_BG_ALPHA_HEX}`,
    color: textColor,
    borderColor: `${c}${COLORED_BADGE_BORDER_ALPHA_HEX}`,
  };
}

type AppColoredBadgeProps = Omit<AppBadgeProps, "state" | "color"> & {
  /** Hex color (#RRGGBB). When set, it overrides the base state's look. */
  color?: string | null;
  /** Fallback without a custom color. */
  state?: AppBadgeState;
};

function AppColoredBadge({
  color,
  state = "metadata",
  className,
  style,
  children,
  ...props
}: AppColoredBadgeProps) {
  const coloredStyle = color ? appColoredBadgeStyle(color) : undefined;

  return (
    <AppBadge
      state={state}
      className={className}
      style={{ ...coloredStyle, ...style }}
      {...props}
    >
      {children}
    </AppBadge>
  );
}

export { AppColoredBadge };
export type { AppColoredBadgeProps };
