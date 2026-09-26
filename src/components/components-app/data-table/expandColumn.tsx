"use client";

import { type ColumnDef,createColumnHelper } from "@tanstack/react-table";
import { Minus, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";

export function createExpandColumn<TData>(args: {
  expandedIds: Set<string>;
  toggleExpanded: (id: string) => void;
  getRowId: (row: TData) => string;
  childCount: (row: TData) => number;
  hasCustomSubTable?: boolean;
}): ColumnDef<TData> {
  const helper = createColumnHelper<TData>();
  return helper.display({
    id: "__expand",
    header: () => <span className="sr-only">Expand</span>,
    cell: ({ row }) => {
      const id = args.getRowId(row.original);
      const n = args.childCount(row.original);
      const canExpand = n > 0 || Boolean(args.hasCustomSubTable);
      if (!canExpand) {
        return <span className="inline-block w-8 shrink-0" aria-hidden />;
      }
      const open = args.expandedIds.has(id);
      return (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-8 shrink-0 rounded-md text-muted-foreground hover:bg-muted/80 hover:text-foreground"
          aria-expanded={open}
          aria-label={open ? "Collapse" : "Expand"}
          onClick={(e) => {
            e.stopPropagation();
            args.toggleExpanded(id);
          }}
        >
          {open ? (
            <Minus className="size-4 stroke-[1.75]" aria-hidden />
          ) : (
            <Plus className="size-4 stroke-[1.75]" aria-hidden />
          )}
        </Button>
      );
    },
    enableSorting: false,
    enableHiding: false,
    meta: {
      displayName: "Expand",
      className:
        "w-9 max-w-9 min-w-9 !px-0 text-center align-middle box-border",
    },
  });
}
