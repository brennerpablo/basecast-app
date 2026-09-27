"use client";

import { AlertTriangleIcon, DatabaseIcon, GitBranchIcon, LayoutGridIcon, ListIcon, SearchIcon } from "lucide-react";
import Link from "next/link";
import { parseAsString, parseAsStringLiteral, useQueryState } from "nuqs";

import { ViewSwitchControl } from "@/components/components-app/ui/view-switch-control";
import EmptyState from "@/components/empty-state";
import { PageBreadcrumb } from "@/components/page-breadcrumb";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";

import { type SourceSummary, type TableSummary, useLakeSources, useTables } from "./api";
import { FolderGlyph, LoadDot } from "./file-kind";
import { formatBytes, formatCount, formatDateTime, formatDtRange } from "./format";
import { LAKE_BUCKET, lakeHref, sourceKey } from "./lake-path";

const GROUP_ORDER = ["ERCOT", "Census", "EIA", "PUCT", "Weather", "Texas", "Other"];
const VIEWS = ["tree", "grid", "list"] as const;

function DatasetDots({ source }: { source: SourceSummary }) {
  const loaded = source.datasets.filter((d) => d.loaded).length;
  if (source.datasets.length === 0) return <span className="text-xs text-muted-foreground">none</span>;
  return (
    <span className="inline-flex items-center gap-2" title={source.datasets.map((d) => `${d.name}: ${d.loaded ? "loaded" : "not loaded yet"}`).join("\n")}>
      <span className="inline-flex gap-0.5">
        {source.datasets.slice(0, 12).map((d) => (
          <LoadDot key={d.name} loaded={d.loaded} />
        ))}
      </span>
      <span className="text-xs tabular-nums text-muted-foreground">
        {loaded}/{source.datasets.length}
      </span>
    </span>
  );
}

function PendingDatasets({ tables }: { tables: TableSummary[] }) {
  const pending = tables.filter((t) => t.kind === "dataset" && !t.loaded);
  if (pending.length === 0) return null;
  return (
    <section className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-amber-200 bg-amber-50/70 px-4 py-2.5 text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
      <AlertTriangleIcon className="size-4 shrink-0" />
      <p className="text-sm font-semibold">
        {pending.length} {pending.length === 1 ? "dataset" : "datasets"} not loaded
      </p>
      <Link href="/data/tables?status=pending" className="text-xs font-medium underline-offset-2 hover:underline">
        See all pending tables
      </Link>
    </section>
  );
}

function SourceRow({ source }: { source: SourceSummary }) {
  return (
    <tr className="relative hover:bg-accent/60">
      <td className="px-3 py-2">
        <Link
          href={lakeHref(sourceKey(source.source_id))}
          className="flex items-center gap-2.5 after:absolute after:inset-0 focus:outline-none focus-visible:after:ring-2 focus-visible:after:ring-ring"
        >
          <FolderGlyph />
          <span className="min-w-0">
            <span className="block font-mono text-[13px] font-medium">{source.source_id}</span>
            <span className="block max-w-72 truncate text-xs text-muted-foreground">{source.name}</span>
          </span>
        </Link>
      </td>
      <td className="px-3 py-2 text-sm">{source.publisher ?? "—"}</td>
      <td className="px-3 py-2 text-right text-sm tabular-nums">{formatCount(source.files)}</td>
      <td className="px-3 py-2 text-right text-sm tabular-nums">{formatBytes(source.bytes)}</td>
      <td className="px-3 py-2 text-sm">
        <span className="tabular-nums">{formatCount(source.snapshots)}</span>{" "}
        <span className="text-xs text-muted-foreground">{formatDtRange(source.first_dt, source.last_dt)}</span>
      </td>
      <td className="px-3 py-2">
        <span className="flex gap-1">
          {source.formats.slice(0, 3).map((f) => (
            <span key={f.extension} className="rounded-full bg-muted px-1.5 py-0.5 text-[11px] tabular-nums text-muted-foreground">
              {f.extension} {f.files}
            </span>
          ))}
          {source.formats.length > 3 ? (
            <span className="rounded-full bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">+{source.formats.length - 3}</span>
          ) : null}
        </span>
      </td>
      <td className="px-3 py-2">
        <DatasetDots source={source} />
      </td>
      <td className="px-3 py-2 text-xs whitespace-nowrap text-muted-foreground">{formatDateTime(source.last_fetched_at)}</td>
    </tr>
  );
}

function SourceTable({ groups }: { groups: [string | null, SourceSummary[]][] }) {
  return (
    <div className="grid-scrollbar overflow-x-auto rounded-lg border">
      <table className="w-full text-sm [&_td]:whitespace-nowrap [&_th]:whitespace-nowrap">
        <thead className="bg-muted/50 text-left text-xs tracking-wide text-muted-foreground uppercase">
          <tr>
            <th className="px-3 py-2 font-medium">Source</th>
            <th className="px-3 py-2 font-medium">Publisher</th>
            <th className="px-3 py-2 text-right font-medium">Files</th>
            <th className="px-3 py-2 text-right font-medium">Size</th>
            <th className="px-3 py-2 font-medium">Snapshots</th>
            <th className="px-3 py-2 font-medium">Formats</th>
            <th className="px-3 py-2 font-medium">Tables</th>
            <th className="px-3 py-2 font-medium">Last fetch</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {groups.map(([group, items]) => [
            group ? (
              <tr key={`g-${group}`} className="bg-muted/40">
                <td colSpan={8} className="px-3 py-1.5 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
                  {group} · {items.length}
                </td>
              </tr>
            ) : null,
            ...items.map((s) => <SourceRow key={s.source_id} source={s} />),
          ])}
        </tbody>
      </table>
    </div>
  );
}

function SourceCards({ items }: { items: SourceSummary[] }) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {items.map((s) => (
        <Link
          key={s.source_id}
          href={lakeHref(sourceKey(s.source_id))}
          className="flex flex-col gap-2 rounded-lg border bg-card p-3 transition-colors hover:border-basecast-brand"
        >
          <span className="flex items-center gap-2 font-mono text-[13px] font-medium">
            <FolderGlyph />
            {s.source_id}
          </span>
          <span className="line-clamp-2 min-h-9 text-xs leading-snug text-muted-foreground" title={s.description || undefined}>
            {s.name}
          </span>
          <span className="flex items-center justify-between text-xs text-muted-foreground tabular-nums">
            <span>
              {formatCount(s.files)} files · {formatBytes(s.bytes)}
            </span>
            <DatasetDots source={s} />
          </span>
        </Link>
      ))}
    </div>
  );
}

/** /data: every raw source the pipeline fetched, as the Documents home lists folders. */
export function DataOverview() {
  const sources = useLakeSources();
  const tables = useTables();
  const [view, setView] = useQueryState("view", parseAsStringLiteral(VIEWS).withDefault("list"));
  const [group, setGroup] = useQueryState("group", parseAsString.withDefault("All"));
  const [q, setQ] = useQueryState("q", parseAsString.withDefault(""));
  const [format, setFormat] = useQueryState("format", parseAsString.withDefault(""));

  const all = sources.data?.items ?? [];
  const groups = GROUP_ORDER.filter((g) => all.some((s) => s.group === g));
  const formats = [...new Set(all.flatMap((s) => s.formats.map((f) => f.extension)))].sort();
  const needle = q.trim().toLowerCase();
  const items = all.filter(
    (s) =>
      (group === "All" || s.group === group) &&
      (!format || s.formats.some((f) => f.extension === format)) &&
      (!needle ||
        s.source_id.includes(needle) ||
        s.name.toLowerCase().includes(needle) ||
        (s.publisher ?? "").toLowerCase().includes(needle)),
  );
  const grouped: [string | null, SourceSummary[]][] =
    view === "tree"
      ? GROUP_ORDER.map((g) => [g, items.filter((s) => s.group === g)] as [string, SourceSummary[]]).filter(
          ([, list]) => list.length > 0,
        )
      : [[null, items]];

  return (
    <div className="space-y-4">
      <PageBreadcrumb items={[{ label: "Data" }]} />
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold">All sources</h2>
          {sources.data ? (
            <p className="text-sm text-muted-foreground">
              {sources.data.totals.sources} sources · {formatCount(sources.data.totals.files)} files ·{" "}
              {formatBytes(sources.data.totals.bytes)} in <span className="font-mono text-xs">{LAKE_BUCKET}/raw</span>
            </p>
          ) : (
            <Skeleton className="mt-1 h-4 w-64" />
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <SearchIcon className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => void setQ(e.target.value || null)}
              placeholder="Search sources"
              aria-label="Search sources"
              className="h-9 w-64 pl-8"
            />
          </div>
          <ViewSwitchControl
            value={view}
            onValueChange={(v) => void setView(v)}
            ariaLabel="How to show the sources"
            options={[
              { value: "tree", label: "By publisher", ariaLabel: "Grouped by publisher", icon: GitBranchIcon },
              { value: "grid", label: "Grid", ariaLabel: "Grid", icon: LayoutGridIcon },
              { value: "list", label: "List", ariaLabel: "List", icon: ListIcon },
            ]}
          />
        </div>
      </div>

      {tables.data ? <PendingDatasets tables={tables.data.items} /> : null}

      <div className="flex flex-nowrap items-center gap-2 overflow-x-auto rounded-lg border bg-card px-3 py-2">
        <ViewSwitchControl
          size="sm"
          value={group}
          onValueChange={(v) => void setGroup(v === "All" ? null : v)}
          ariaLabel="Filter by publisher"
          options={["All", ...groups].map((g) => ({
            value: g,
            label: `${g} ${g === "All" ? all.length : all.filter((s) => s.group === g).length}`,
          }))}
        />
        <div className="ml-auto flex shrink-0 items-center gap-2">
          <select
            value={format}
            onChange={(e) => void setFormat(e.target.value || null)}
            aria-label="Filter by format"
            className="h-7 rounded-md border bg-background px-2 text-xs"
          >
            <option value="">All formats</option>
            {formats.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>
          {group !== "All" || format || q ? (
            <button
              type="button"
              onClick={() => {
                void setGroup(null);
                void setFormat(null);
                void setQ(null);
              }}
              className="text-xs font-medium text-basecast-brand hover:underline"
            >
              Clear
            </button>
          ) : null}
        </div>
      </div>

      {sources.isPending ? (
        <Skeleton className="h-96 w-full" />
      ) : sources.isError ? (
        <EmptyState Icon={DatabaseIcon} title="The lake could not be read" description={sources.error.message} />
      ) : items.length === 0 ? (
        <EmptyState Icon={SearchIcon} title="No source matches these filters" compact />
      ) : view === "grid" ? (
        <SourceCards items={items} />
      ) : (
        <SourceTable groups={grouped} />
      )}
    </div>
  );
}
