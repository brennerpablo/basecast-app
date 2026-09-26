"use client";

import { DatabaseIcon, HistoryIcon, SearchIcon, TableIcon } from "lucide-react";
import Link from "next/link";
import { parseAsString, parseAsStringLiteral, useQueryState } from "nuqs";

import { ViewSwitchControl } from "@/components/components-app/ui/view-switch-control";
import EmptyState from "@/components/empty-state";
import { PageBreadcrumb } from "@/components/page-breadcrumb";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";

import { type TableSummary, useTables } from "./api";
import { LoadDot } from "./file-kind";
import { formatBytes, formatCount } from "./format";
import { lakeHref, sourceKey } from "./lake-path";

const STATUS = ["all", "loaded", "pending", "postgres", "bigquery", "derived"] as const;
type Status = (typeof STATUS)[number];

function matches(t: TableSummary, status: Status): boolean {
  switch (status) {
    case "loaded":
      return t.loaded;
    case "pending":
      return !t.loaded;
    case "postgres":
    case "bigquery":
      return t.engine === status;
    case "derived":
      return t.mode === "sql";
    default:
      return true;
  }
}

export function rowsLabel(t: Pick<TableSummary, "loaded" | "rows" | "rows_estimated">): string {
  if (!t.loaded) return "—";
  if (t.rows === null || t.rows === undefined) return "n/a";
  return `${t.rows_estimated ? "≈" : ""}${formatCount(t.rows)}`;
}

function TableRow({ t }: { t: TableSummary }) {
  const Icon = t.kind === "system" ? HistoryIcon : t.engine === "bigquery" ? DatabaseIcon : TableIcon;
  return (
    <tr className="hover:bg-accent/60">
      <td className="px-3 py-2">
        {t.loaded ? (
          <Link href={`/data/tables/${t.name}`} className="flex items-center gap-2 font-mono text-xs font-medium hover:text-basecast-brand hover:underline">
            <Icon className="size-4 shrink-0 text-muted-foreground" />
            {t.name}
          </Link>
        ) : (
          <span className="flex items-center gap-2 font-mono text-xs text-muted-foreground" title="Declared by the pipeline, not loaded yet">
            <Icon className="size-4 shrink-0" />
            {t.name}
          </span>
        )}
      </td>
      <td className="px-3 py-2">
        <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
          {t.engine === "bigquery" ? "BigQuery" : "Postgres"}
        </span>
      </td>
      <td className="px-3 py-2 font-mono text-xs">
        {t.sources.length === 0 ? (
          <span className="text-muted-foreground">{t.kind === "system" ? "pipeline" : "—"}</span>
        ) : (
          t.sources.map((s, i) => (
            <span key={s}>
              {i > 0 ? ", " : null}
              {s === "config_facts" ? (
                <span className="text-muted-foreground" title="Hand-curated YAML in basecast-airflow">config</span>
              ) : (
                <Link href={lakeHref(sourceKey(s))} className="hover:text-basecast-brand hover:underline">
                  {s}
                </Link>
              )}
            </span>
          ))
        )}
      </td>
      <td className="px-3 py-2 font-mono text-xs">{t.kind === "system" ? "system" : t.mode === "sql" ? "SQL" : (t.mode ?? "—")}</td>
      <td className="px-3 py-2 text-right tabular-nums">{rowsLabel(t)}</td>
      <td className="px-3 py-2 text-right tabular-nums">{t.loaded ? formatBytes(t.bytes) : "—"}</td>
      <td className="px-3 py-2">
        <span className="flex items-center gap-1.5 text-xs">
          <LoadDot loaded={t.loaded} />
          {t.loaded ? "Loaded" : <span className="text-muted-foreground">Not loaded</span>}
        </span>
      </td>
    </tr>
  );
}

/** /data/tables: every dataset the pipeline declares, and whether its table exists yet. */
export function TablesCatalog() {
  const tables = useTables();
  const [status, setStatus] = useQueryState("status", parseAsStringLiteral(STATUS).withDefault("all"));
  const [q, setQ] = useQueryState("q", parseAsString.withDefault(""));
  const items = tables.data?.items ?? [];
  const datasets = items.filter((t) => t.kind === "dataset");
  const needle = q.trim().toLowerCase();
  const shown = items.filter(
    (t) => matches(t, status) && (!needle || t.name.includes(needle) || t.sources.some((s) => s.includes(needle))),
  );
  const count = (s: Status) => items.filter((t) => matches(t, s)).length;

  return (
    <div className="space-y-4">
      <PageBreadcrumb items={[{ label: "Data", href: "/data" }, { label: "Tables" }]} />
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Tables</h2>
          <p className="text-sm text-muted-foreground">
            {tables.data
              ? `${datasets.length} datasets declared by the pipeline · ${datasets.filter((t) => t.loaded && t.engine === "postgres").length} loaded in Postgres · ${datasets.filter((t) => t.loaded && t.engine === "bigquery").length} in BigQuery`
              : "Reading the catalog…"}
          </p>
        </div>
        <div className="relative">
          <SearchIcon className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => void setQ(e.target.value || null)}
            placeholder="Search tables or sources"
            aria-label="Search tables"
            className="h-9 w-64 pl-8"
          />
        </div>
      </div>

      <div className="flex flex-nowrap items-center gap-2 overflow-x-auto rounded-lg border bg-card px-3 py-2">
        <ViewSwitchControl
          size="sm"
          value={status}
          onValueChange={(v) => void setStatus(v === "all" ? null : v)}
          ariaLabel="Filter tables"
          options={STATUS.map((s) => ({ value: s, label: `${s === "all" ? "All" : s === "bigquery" ? "BigQuery" : s[0].toUpperCase() + s.slice(1)} ${count(s)}` }))}
        />
        <span className="ml-auto shrink-0 text-xs text-muted-foreground">≈ is Postgres&apos;s estimate; the grid counts exactly</span>
      </div>

      {tables.isPending ? (
        <Skeleton className="h-96 w-full" />
      ) : tables.isError ? (
        <EmptyState Icon={TableIcon} title="The catalog could not be read" description={tables.error.message} />
      ) : shown.length === 0 ? (
        <EmptyState Icon={SearchIcon} title="No table matches these filters" compact />
      ) : (
        <div className="grid-scrollbar overflow-x-auto rounded-lg border">
          <table className="w-full text-sm [&_td]:whitespace-nowrap [&_th]:whitespace-nowrap">
            <thead className="bg-muted/50 text-left text-xs tracking-wide text-muted-foreground uppercase">
              <tr>
                <th className="px-3 py-2 font-medium">Table</th>
                <th className="px-3 py-2 font-medium">Engine</th>
                <th className="px-3 py-2 font-medium">Source</th>
                <th className="px-3 py-2 font-medium">Mode</th>
                <th className="px-3 py-2 text-right font-medium">Rows</th>
                <th className="px-3 py-2 text-right font-medium">Size</th>
                <th className="px-3 py-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {shown.map((t) => (
                <TableRow key={`${t.engine}-${t.name}`} t={t} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
