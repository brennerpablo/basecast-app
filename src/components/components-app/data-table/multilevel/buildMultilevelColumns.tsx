"use client";

import { type ColumnDef,createColumnHelper } from "@tanstack/react-table";

import type { ColumnMetadata } from "../types";
import {
  MULTILEVEL_HIERARCHY_COLUMN_ID,
  type MultilevelFlatRow,
} from "./treeUtils";

export function createHierarchyColumn<TPayload>(
  title: string,
  columnClassName?: string,
): ColumnDef<MultilevelFlatRow<TPayload>> {
  const helper = createColumnHelper<MultilevelFlatRow<TPayload>>();
  return helper.display({
    id: MULTILEVEL_HIERARCHY_COLUMN_ID,
    header: () => (
      <span className="text-[13px] font-medium leading-none">{title}</span>
    ),
    cell: () => null,
    enableSorting: false,
    enableHiding: false,
    meta: {
      displayName: title,
      className: columnClassName ?? "min-w-[12rem] text-left",
    },
  });
}

export function dataColumnsMetadata<TPayload>(
  metadata: readonly ColumnMetadata<MultilevelFlatRow<TPayload>>[],
) {
  return metadata.filter((c) => !c.filterOnly);
}
