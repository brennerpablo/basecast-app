import type { BadgeProps } from "./badge";

/** Compact metric for states that keep a legacy (ring) variant. */
export const BADGE_METRIC_CLASS = "h-5 py-0 px-1.5 text-[11px] tabular-nums";

export const APP_BADGE_STATES = [
  "active",
  "inactive",
  "pending",
  "processing",
  "new",
  "critical",
  "severe",
  "ignored",
  "alert",
  "info",
  "metadata",
  "draft",
  "historical",
  "count",
  "meta",
  "ticker",
] as const;

export type AppBadgeState = (typeof APP_BADGE_STATES)[number];

export type AppBadgeResolution =
  | {
      mode: "variant";
      variant: NonNullable<BadgeProps["variant"]>;
    }
  | {
      mode: "meta";
      variant: "meta";
    };

/** Product state → visual variant. */
export const APP_BADGE_REGISTRY: Record<AppBadgeState, AppBadgeResolution> = {
  active: { mode: "variant", variant: "active" },
  inactive: { mode: "variant", variant: "muted" },
  pending: { mode: "variant", variant: "alert" },
  processing: { mode: "variant", variant: "processing" },
  new: { mode: "variant", variant: "active" },
  critical: { mode: "variant", variant: "critical" },
  severe: { mode: "variant", variant: "severe" },
  ignored: { mode: "variant", variant: "muted" },
  alert: { mode: "variant", variant: "alert" },
  info: { mode: "variant", variant: "processing" },
  metadata: { mode: "variant", variant: "metadata" },
  draft: { mode: "variant", variant: "draft" },
  historical: { mode: "variant", variant: "muted" },
  count: { mode: "meta", variant: "meta" },
  meta: { mode: "meta", variant: "meta" },
  ticker: { mode: "meta", variant: "meta" },
};

export function resolveAppBadge(state: AppBadgeState): AppBadgeResolution {
  return APP_BADGE_REGISTRY[state];
}

export function appStateForActiveInactive(isActive: boolean): AppBadgeState {
  return isActive ? "active" : "inactive";
}
