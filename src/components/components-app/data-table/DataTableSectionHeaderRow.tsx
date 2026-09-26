"use client";

import { ChevronDown, ChevronRight } from "lucide-react";

import { TableCell, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";

import type { DataTableSectionDef } from "./types";

type DataTableSectionHeaderRowProps = {
  section: DataTableSectionDef;
  collapsed: boolean;
  colSpan: number;
  compact?: boolean;
  isGhost?: boolean;
  onToggle: () => void;
  renderSectionHeader?: (args: {
    section: DataTableSectionDef;
    collapsed: boolean;
    onToggle: () => void;
    rowCount: number;
  }) => React.ReactNode;
  rowCount: number;
};

export function DataTableSectionHeaderRow({
  section,
  collapsed,
  colSpan,
  compact,
  isGhost,
  onToggle,
  renderSectionHeader,
  rowCount,
}: DataTableSectionHeaderRowProps) {
  const content = renderSectionHeader ? (
    renderSectionHeader({ section, collapsed, onToggle, rowCount })
  ) : (
    <button
      type="button"
      className="flex w-full items-center gap-2 text-left text-sm font-semibold text-slate-700 dark:text-slate-300"
      onClick={onToggle}
      aria-expanded={!collapsed}
    >
      {collapsed ? (
        <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
      ) : (
        <ChevronDown className="size-4 shrink-0 text-muted-foreground" aria-hidden />
      )}
      <span>{section.label}</span>
    </button>
  );

  return (
    <TableRow className={cn(!isGhost && "border-border bg-muted/30 hover:bg-muted/30")}>
      <TableCell
        colSpan={colSpan}
        className={cn(compact ? "py-1.5" : "py-2.5", "border-border")}
      >
        {content}
      </TableCell>
    </TableRow>
  );
}
