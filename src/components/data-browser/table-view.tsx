"use client";

import { DatabaseIcon, KeyRoundIcon, TableIcon } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/components-app/ui/tabs";
import {
  DataGrid,
  defaultColumnState,
  type GridColumn,
  type GridColumnState,
  type GridFilterState,
  type GridSortState,
  sanitizeColumnState,
} from "@/components/data-grid";
import EmptyState from "@/components/empty-state";
import { PageBreadcrumb } from "@/components/page-breadcrumb";
import { useTabState } from "@/components/tabs/tab-screen";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { gridFilterParams } from "@/lib/get-data/grid";
import { buildGridParams } from "@/lib/grid-params";
import { fetchGridExportRows, useGridWindowQuery } from "@/lib/hooks/use-grid-window-query";

import { type TableDetail, useLineage, useTable } from "./api";
import { LoadDot } from "./file-kind";
import { formatBytes, formatCellText, formatCount, formatDateTime } from "./format";
import { columnWidth, gridType } from "./lake-grid";
import { lakeHref, sourceKey } from "./lake-path";
import { rowsLabel } from "./tables-catalog";

type Row = Record<string, unknown>;
type Summary = { count: number; estimated: boolean };

const LINK_COLUMNS = new Set(["source_file", "raw_key", "zcta_source_file", "zip_zone_source_file", "territory_source_file"]);
const MONO = /(^|_)(id|ids|key|code|fips|inr|sha256|file|ccn_no)$/;


function TableRows({ table }: { table: TableDetail }) {
  const columns = useMemo<GridColumn<Row>[]>(
    () =>
      table.columns.map((c) => {
        const filterable = c.type !== "geometry" && c.type !== "json";
        const column: GridColumn<Row> = {
          id: c.name,
          title: c.name,
          type: gridType(c),
          width: columnWidth(c, false),
          sortable: filterable,
          mono: MONO.test(c.name),
          format: formatCellText,
          filter: filterable ? { conditions: gridType(c), paramMap: gridFilterParams(c.name) } : undefined,
        };
        if (LINK_COLUMNS.has(c.name)) {
          column.action = {
            href: (row) => {
              const value = row[c.name];
              return typeof value === "string" && value.startsWith("raw/") ? lakeHref(value) : null;
            },
          };
        }
        return column;
      }),
    [table.columns],
  );

  const [columnState, setColumnState] = useTabState<GridColumnState | null>(`data-table:${table.name}:columns`, null);
  const [filters, setFilters] = useTabState<GridFilterState>(`data-table:${table.name}:filters`, {});
  const [sorting, setSorting] = useTabState<GridSortState>(`data-table:${table.name}:sort`, null);
  const state = sanitizeColumnState(columnState ?? defaultColumnState(columns), columns);
  const paramsQs = buildGridParams(columns, filters, sorting);
  const apiUrl = `/api/data/grid/table/${table.name}`;
  const grid = useGridWindowQuery<Row, Summary>({ apiUrl, queryKey: ["data", "table-grid", table.name], paramsQs });

  return (
    <div className="space-y-2">
      {grid.isError ? (
        <p className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">{grid.error?.message}</p>
      ) : null}
      {grid.summary?.estimated ? (
        <p className="text-xs text-muted-foreground">
          The total is Postgres&apos;s estimate: counting every matching row took too long. Filter to get an exact count.
        </p>
      ) : null}
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
        summary={grid.summary ? { count: grid.summary.count } : null}
        sorting={sorting}
        onSortingChange={setSorting}
        filters={filters}
        onFiltersChange={setFilters}
        resetToken={paramsQs}
        className="h-[62vh] min-h-[420px]"
        toolbar={{
          savedViews: { storageKey: `basecast.data-table.${table.name}` },
          export: {
            filename: table.name,
            totalCount: grid.totalCount,
            fetchRows: (onProgress) => fetchGridExportRows<Row>({ apiUrl, paramsQs, totalCount: grid.totalCount, onProgress }),
          },
        }}
      />
    </div>
  );
}

function Schema({ table }: { table: TableDetail }) {
  return (
    <div className="grid-scrollbar overflow-x-auto rounded-lg border">
      <table className="w-full text-sm [&_td]:whitespace-nowrap [&_th]:whitespace-nowrap">
        <thead className="bg-muted/50 text-left text-xs tracking-wide text-muted-foreground uppercase">
          <tr>
            <th className="px-3 py-2 text-right font-medium">#</th>
            <th className="px-3 py-2 font-medium">Column</th>
            <th className="px-3 py-2 font-medium">Type</th>
            <th className="px-3 py-2 font-medium">Nullable</th>
            <th className="px-3 py-2 font-medium">Role</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {table.columns.map((c) => (
            <tr key={c.name}>
              <td className="px-3 py-2 text-right text-muted-foreground tabular-nums">{c.position}</td>
              <td className="px-3 py-2 font-mono text-xs">{c.name}</td>
              <td className="px-3 py-2 font-mono text-xs text-muted-foreground">{c.source_type ?? c.type}</td>
              <td className="px-3 py-2 text-xs">{c.nullable ? "yes" : "no"}</td>
              <td className="px-3 py-2 text-xs">
                {c.is_key ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-basecast-brand-surface px-2 py-0.5 text-basecast-brand">
                    <KeyRoundIcon className="size-3" />
                    key
                  </span>
                ) : c.name === table.partition_field ? (
                  "partition"
                ) : table.cluster_fields.includes(c.name) ? (
                  "cluster"
                ) : LINK_COLUMNS.has(c.name) ? (
                  "lineage"
                ) : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Lineage({ table }: { table: TableDetail }) {
  const [offset, setOffset] = useState(0);
  const lineage = useLineage(table.name, offset);
  if (table.derived) {
    return (
      <EmptyState
        Icon={TableIcon}
        title="Built by SQL from other tables"
        description={`${table.name} is derived inside Postgres, so it reads no raw file of its own.`}
      />
    );
  }
  if (lineage.isPending) return <Skeleton className="h-80 w-full" />;
  if (lineage.isError) return <EmptyState Icon={TableIcon} title="The lineage could not be read" description={lineage.error.message} />;
  const page = lineage.data;
  if (page.total === 0) return <EmptyState Icon={TableIcon} title="No raw file recorded for this table" compact />;
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        {formatCount(page.total)} raw files fed this table (<span className="font-mono text-xs">lake_processed</span>).
      </p>
      <div className="grid-scrollbar overflow-x-auto rounded-lg border">
        <table className="w-full text-sm [&_td]:whitespace-nowrap [&_th]:whitespace-nowrap">
          <thead className="bg-muted/50 text-left text-xs tracking-wide text-muted-foreground uppercase">
            <tr>
              <th className="px-3 py-2 font-medium">Raw file</th>
              <th className="px-3 py-2 text-right font-medium">Rows</th>
              <th className="px-3 py-2 font-medium">Version</th>
              <th className="px-3 py-2 font-medium">Processed</th>
              <th className="px-3 py-2 font-medium">SHA-256</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {page.items.map((item) => (
              <tr key={item.raw_key} className="hover:bg-accent/60">
                <td className="px-3 py-2">
                  <Link href={lakeHref(item.raw_key)} className="font-mono text-xs hover:text-basecast-brand hover:underline">
                    {item.raw_key}
                  </Link>
                </td>
                <td className="px-3 py-2 text-right tabular-nums">{formatCount(item.rows)}</td>
                <td className="px-3 py-2 text-xs">v{item.version}</td>
                <td className="px-3 py-2 text-xs text-muted-foreground">{formatDateTime(item.processed_at)}</td>
                <td className="px-3 py-2 font-mono text-[11px] text-muted-foreground">{item.sha256.slice(0, 12)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span className="tabular-nums">
          {formatCount(page.offset + 1)}–{formatCount(page.offset + page.items.length)} of {formatCount(page.total)}
        </span>
        <div className="flex gap-2">
          <Button variant="outline" size="xs" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - page.limit))}>
            Previous
          </Button>
          <Button variant="outline" size="xs" disabled={offset + page.limit >= page.total} onClick={() => setOffset(offset + page.limit)}>
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}

/** /data/tables/[name]: one processed table, its rows in the DataGrid, its columns and its raw files. */
export function TableView({ name }: { name: string }) {
  const table = useTable(name);
  const t = table.data;
  const Icon = t?.engine === "bigquery" ? DatabaseIcon : TableIcon;
  return (
    <div className="space-y-4">
      <PageBreadcrumb items={[{ label: "Data", href: "/data" }, { label: "Tables", href: "/data/tables" }, { label: name }]} />
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-3">
          <Icon className="mt-0.5 size-8 shrink-0 text-basecast-brand" />
          <div className="min-w-0 space-y-1.5">
            <h2 className="font-mono text-[15px] font-semibold break-all">{name}</h2>
            {t ? (
              <div className="flex flex-wrap gap-1.5 text-[11px] text-muted-foreground">
                <span className="rounded-md border px-2 py-0.5">
                  {t.engine === "bigquery" ? "BigQuery" : "Postgres"} · {t.location}
                </span>
                {t.mode ? (
                  <span className="rounded-md border px-2 py-0.5">
                    {t.mode === "sql" ? "SQL, derived" : t.mode}
                    {t.key_columns.length ? ` (${t.key_columns.join(", ")})` : ""}
                  </span>
                ) : null}
                <span className="rounded-md border px-2 py-0.5 tabular-nums">{rowsLabel(t)} rows</span>
                {t.loaded ? <span className="rounded-md border px-2 py-0.5 tabular-nums">{formatBytes(t.bytes)}</span> : null}
                {t.partition_field ? <span className="rounded-md border px-2 py-0.5">partition {t.partition_field}</span> : null}
              </div>
            ) : null}
            {t?.description ? <p className="max-w-3xl text-sm text-muted-foreground">{t.description}</p> : null}
            {t && t.sources.length > 0 ? (
              <p className="text-xs text-muted-foreground">
                From{" "}
                {t.sources.map((s, i) => (
                  <span key={s}>
                    {i > 0 ? ", " : null}
                    {s === "config_facts" ? (
                      "config"
                    ) : (
                      <Link href={lakeHref(sourceKey(s))} className="font-mono text-basecast-brand hover:underline">
                        {s}
                      </Link>
                    )}
                  </span>
                ))}
              </p>
            ) : null}
          </div>
        </div>
        {t?.loaded ? (
          <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
            <LoadDot loaded />
            Loaded
          </span>
        ) : null}
      </div>

      {table.isPending ? (
        <Skeleton className="h-[62vh] w-full" />
      ) : table.isError ? (
        <EmptyState Icon={TableIcon} title="This table could not be read" description={table.error.message} />
      ) : !table.data.loaded ? (
        <EmptyState
          Icon={TableIcon}
          title="Declared by the pipeline, not loaded yet"
          description="The registry lists this dataset, but its table does not exist yet. It appears here after the next process run."
        />
      ) : (
        <Tabs urlParam="tab" defaultValue="rows" className="space-y-4">
          <TabsList variant="solid">
            <TabsTrigger value="rows">Rows</TabsTrigger>
            <TabsTrigger value="schema">Schema · {table.data.columns.length}</TabsTrigger>
            <TabsTrigger value="lineage">Lineage</TabsTrigger>
          </TabsList>
          <TabsContent value="rows">
            <TableRows table={table.data} />
          </TabsContent>
          <TabsContent value="schema">
            <Schema table={table.data} />
          </TabsContent>
          <TabsContent value="lineage">
            <Lineage table={table.data} />
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
