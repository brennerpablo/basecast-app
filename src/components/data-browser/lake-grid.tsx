"use client";

import { useQuery } from "@tanstack/react-query";
import { TableIcon } from "lucide-react";
import { useMemo, useState } from "react";

import {
  DataGrid,
  defaultColumnState,
  type GridColumn,
  type GridColumnState,
  type GridColumnType,
  sanitizeColumnState,
  spreadsheetColumnName,
} from "@/components/data-grid";
import EmptyState from "@/components/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchGridExportRows, useGridWindowQuery } from "@/lib/hooks/use-grid-window-query";

import { fetchData, type GridColumnInfo, type RowsPage } from "./api";
import { formatCellText } from "./format";

type Row = Record<string, unknown>;

export function gridType(column: GridColumnInfo): GridColumnType {
  return column.type === "number" ? "number" : column.type === "date" ? "date" : "text";
}

/** A default width from the column's name, kind and a sample value; the user can resize and autosize. */
export function columnWidth(column: GridColumnInfo, positional: boolean, sample?: unknown): number {
  if (positional) return 140;
  const text = sample === null || sample === undefined ? "" : formatCellText(sample);
  const chars = Math.max(column.name.length + 2, text.length);
  if (column.type === "number") return Math.min(200, Math.max(100, chars * 8 + 32));
  return Math.min(340, Math.max(110, chars * 7.5 + 32));
}


/**
 * A raw file's rows in the DataGrid, in blocks from get-data. Spreadsheets and delimited text are
 * positional (A, B, C… and the file's own row numbers) and unsorted: the grid shows what the source
 * published.
 */
export function LakeGrid({
  lakeKey,
  member,
  sheet,
  className = "h-[62vh] min-h-[420px]",
}: {
  lakeKey: string;
  member?: string | null;
  sheet?: string | null;
  className?: string;
}) {
  // One row with the total tells the columns before the window starts.
  const head = useQuery({
    queryKey: ["data", "head", lakeKey, member ?? null, sheet ?? null],
    queryFn: ({ signal }) =>
      fetchData<RowsPage>("lake/object/rows", { key: lakeKey, member, sheet, limit: 1, with_summary: true }, signal),
    staleTime: Infinity,
  });

  const positional = Boolean(head.data?.columns.every((c, i) => c.name === spreadsheetColumnName(i)));
  const columns = useMemo<GridColumn<Row>[]>(
    () =>
      (head.data?.columns ?? []).map((c, i) => ({
        id: c.name,
        title: c.name,
        type: positional ? "text" : gridType(c),
        width: columnWidth(c, positional, head.data?.rows[0]?.[i]),
        mono: !positional && (c.type === "text" && /(^|_)(id|key|code|file|sha)/.test(c.name)),
        format: formatCellText,
      })),
    [head.data, positional],
  );

  const qs = new URLSearchParams({ key: lakeKey });
  if (member) qs.set("member", member);
  if (sheet) qs.set("sheet", sheet);
  const apiUrl = `/api/data/grid/lake?${qs.toString()}`;
  const grid = useGridWindowQuery<Row>({
    apiUrl,
    queryKey: ["data", "lake-grid", lakeKey, member ?? null, sheet ?? null],
    paramsQs: "",
    enabled: columns.length > 0,
  });

  const [columnState, setColumnState] = useState<GridColumnState | null>(null);
  const state = sanitizeColumnState(columnState ?? defaultColumnState(columns), columns);

  if (head.isPending) return <Skeleton className={className} />;
  if (head.isError) return <EmptyState Icon={TableIcon} title="The rows could not be read" description={head.error.message} />;
  if (columns.length === 0) return <EmptyState Icon={TableIcon} title="This sheet is empty" compact />;

  const name = (member ?? lakeKey).split("/").at(-1) ?? "rows";
  return (
    <DataGrid<Row>
      columns={columns}
      columnState={state}
      onColumnStateChange={setColumnState}
      rowCount={grid.rowCount}
      totalCount={grid.totalCount}
      getRow={grid.getRow}
      onViewportChange={grid.onViewportChange}
      isFetching={grid.isFetching}
      isRefreshing={grid.isRefreshing}
      sorting={null}
      onSortingChange={() => {}}
      filters={{}}
      onFiltersChange={() => {}}
      resetToken={apiUrl}
      className={className}
      toolbar={{
        export: {
          filename: sheet ? `${name} - ${sheet}` : name,
          totalCount: grid.totalCount,
          fetchRows: (onProgress) =>
            fetchGridExportRows<Row>({ apiUrl, paramsQs: "", totalCount: grid.totalCount, onProgress }),
        },
      }}
    />
  );
}
