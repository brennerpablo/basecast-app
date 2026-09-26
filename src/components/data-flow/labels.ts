import { CogIcon, DownloadIcon, GitMergeIcon, LandmarkIcon, type LucideIcon, Table2Icon, WorkflowIcon } from "lucide-react";

import type { FlowKind, FlowNode } from "./graph";
import type { DataHealth } from "./health";

export const KIND: Record<FlowKind, { label: string; Icon: LucideIcon; color: string }> = {
  origin: { label: "Origin", Icon: LandmarkIcon, color: "var(--flow-origin)" },
  ingest: { label: "Ingest · raw", Icon: DownloadIcon, color: "var(--flow-ingest)" },
  process: { label: "Process", Icon: CogIcon, color: "var(--flow-process)" },
  pipeline: { label: "Pipeline", Icon: WorkflowIcon, color: "var(--flow-process)" },
  table: { label: "Table", Icon: Table2Icon, color: "var(--basecast-brand)" },
  derived: { label: "Derived · SQL", Icon: GitMergeIcon, color: "var(--basecast-brand)" },
};

/**
 * The kind colors, set on the canvas: stone, cyan and violet for the steps; tables use the brand ink.
 * Each hue has a dark value for the dark themes.
 */
export const KIND_COLOR_VARS =
  "[--flow-origin:#6b655c] [--flow-ingest:#0e7490] [--flow-process:#7a4fc2] " +
  "dark:[--flow-origin:#b8b1a7] dark:[--flow-ingest:#5cc6e0] dark:[--flow-process:#b597ee]";

export const HEALTH_LABEL: Record<DataHealth, string> = {
  healthy: "Up to date",
  running: "Running",
  stale: "Overdue",
  degraded: "Degraded",
  failed: "Failed",
  never: "Never updated",
};

export const MODE_TEXT: Record<string, string> = {
  replace: "Rebuilt from every selected file; the latest snapshot wins.",
  by_file: "Rows belong to one raw file; reprocessing a file replaces its rows.",
  by_key: "Newer rows replace the rows with the same key (overlapping time series).",
  sql: "Rebuilt by one SELECT over other tables after its pipeline runs.",
};

/** `just now`, `12 min ago`, `5 h ago`, `3 d ago`. */
export function formatAgo(iso: string | null | undefined, now: number): string {
  if (!iso) return "never";
  const minutes = Math.round((now - Date.parse(iso)) / 60_000);
  if (minutes < 2) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = minutes / 60;
  if (hours < 36) return `${Math.round(hours)} h ago`;
  return `${Math.round(hours / 24)} d ago`;
}

/** The health line at the foot of a node: when the data last updated, and what is wrong if anything. */
export function healthLine(node: FlowNode, now: number): string {
  const { status, updatedAt } = node.health;
  const ago = formatAgo(updatedAt, now);
  if (node.kind === "origin") {
    if (node.unhealthy > 0) return `${node.unhealthy} of ${node.sources} need attention`;
    return status === "running" ? `Updated ${ago} · running` : `Updated ${ago}`;
  }
  const verb = node.kind === "ingest" ? "Fetched" : "Updated";
  switch (status) {
    case "never":
      return node.kind === "table" || node.kind === "derived" ? "Not loaded yet" : node.kind === "ingest" ? "Never fetched" : "Never ran";
    case "running":
      return updatedAt ? `Running · ${verb.toLowerCase()} ${ago}` : "Running now";
    case "failed":
      return updatedAt ? `Failed · ${verb.toLowerCase()} ${ago}` : "Failed";
    case "degraded":
      return updatedAt ? `Last run incomplete · ${ago}` : "Last run incomplete";
    case "stale":
      return `${verb} ${ago} · overdue`;
    default:
      return `${verb} ${ago}`;
  }
}
