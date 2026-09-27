"use client";

import { ChevronRightIcon, ExternalLinkIcon, FolderXIcon, GitBranchIcon, ListIcon, SearchIcon } from "lucide-react";
import Link from "next/link";
import { parseAsString, parseAsStringLiteral, useQueryState } from "nuqs";
import { Fragment, useState } from "react";

import { ViewSwitchControl } from "@/components/components-app/ui/view-switch-control";
import EmptyState from "@/components/empty-state";
import { PageBreadcrumb } from "@/components/page-breadcrumb";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

import { type LakeObject, type Schemas, type SourceSummary, useLakeList, useLakeSources } from "./api";
import { FileKindIcon, FolderGlyph, LoadDot } from "./file-kind";
import { formatBytes, formatCount, formatDateTime, formatDtRange, middleTruncate } from "./format";
import { LakeCrumbs } from "./lake-crumbs";
import { folderPrefix, lakeHref, parseKey } from "./lake-path";
import { SnapshotTimeline } from "./snapshot-timeline";

type Folder = Schemas["LakeFolder"];

function FileRow({ object, indent, showFolder }: { object: LakeObject; indent?: boolean; showFolder?: boolean }) {
  return (
    <tr className="relative hover:bg-accent/60">
      <td className={cn("py-2 pr-3", indent ? "pl-12" : "pl-3")}>
        <Link
          href={lakeHref(object.key)}
          title={object.file}
          className="flex items-center gap-2 after:absolute after:inset-0 focus:outline-none focus-visible:after:ring-2 focus-visible:after:ring-ring"
        >
          <FileKindIcon kind={object.kind} />
          <span className="font-mono text-xs">{middleTruncate(object.file, indent ? 72 : 64)}</span>
        </Link>
      </td>
      {showFolder ? <td className="px-3 py-2 font-mono text-xs text-muted-foreground">dt={object.dt}</td> : null}
      <td className="px-3 py-2 text-right text-xs text-muted-foreground">—</td>
      <td className="px-3 py-2 text-right text-sm tabular-nums">{formatBytes(object.bytes)}</td>
      <td className="px-3 py-2 text-xs text-muted-foreground">{formatDateTime(object.fetched_at)}</td>
      <td className="px-3 py-2 font-mono text-[11px] text-muted-foreground">{object.sha256?.slice(0, 12) ?? "—"}</td>
    </tr>
  );
}

/** The files of one `dt=` folder, loaded when the folder is expanded in the tree. */
function FolderFiles({ folder }: { folder: Folder }) {
  const listing = useLakeList(folder.prefix);
  if (listing.isPending) {
    return (
      <tr>
        <td colSpan={5} className="py-2 pl-12 text-xs text-muted-foreground">
          Loading files…
        </td>
      </tr>
    );
  }
  return (
    <>
      {(listing.data?.objects ?? []).map((o) => (
        <FileRow key={o.key} object={o} indent />
      ))}
    </>
  );
}

function FolderRow({
  folder,
  open,
  onToggle,
}: {
  folder: Folder;
  open?: boolean;
  onToggle?: () => void;
}) {
  return (
    <tr className="hover:bg-accent/60">
      <td className="py-2 pr-3 pl-3">
        <div className="flex items-center gap-1.5">
          {onToggle ? (
            <button
              type="button"
              onClick={onToggle}
              aria-expanded={open}
              aria-label={`${open ? "Collapse" : "Expand"} ${folder.name}`}
              className="grid size-6 place-items-center rounded text-muted-foreground hover:bg-accent"
            >
              <ChevronRightIcon className={cn("size-3.5 transition-transform", open && "rotate-90")} />
            </button>
          ) : null}
          <Link href={lakeHref(folder.prefix)} className="flex items-center gap-2 hover:underline">
            <FolderGlyph open={open} />
            <span className="font-mono text-xs">{folder.name}</span>
          </Link>
        </div>
      </td>
      <td className="px-3 py-2 text-right text-sm tabular-nums">{formatCount(folder.files)}</td>
      <td className="px-3 py-2 text-right text-sm tabular-nums">{formatBytes(folder.bytes)}</td>
      <td className="px-3 py-2 text-xs text-muted-foreground">{formatDateTime(folder.last_fetched_at)}</td>
      <td />
    </tr>
  );
}

function ListingTable({ children, showFolder }: { children: React.ReactNode; showFolder?: boolean }) {
  return (
    <div className="grid-scrollbar overflow-x-auto rounded-lg border">
      <table className="w-full text-sm [&_td]:whitespace-nowrap [&_th]:whitespace-nowrap">
        <thead className="bg-muted/50 text-left text-xs tracking-wide text-muted-foreground uppercase">
          <tr>
            <th className="px-3 py-2 font-medium">Name</th>
            {showFolder ? <th className="px-3 py-2 font-medium">Folder</th> : null}
            <th className="px-3 py-2 text-right font-medium">Files</th>
            <th className="px-3 py-2 text-right font-medium">Size</th>
            <th className="px-3 py-2 font-medium">Fetched</th>
            <th className="px-3 py-2 font-medium">SHA-256</th>
          </tr>
        </thead>
        <tbody className="divide-y">{children}</tbody>
      </table>
    </div>
  );
}

function SourceFacts({ source }: { source: SourceSummary }) {
  let host = "";
  try {
    host = source.upstream_url ? new URL(source.upstream_url).host : "";
  } catch {
    host = "";
  }
  const lastRun = [...source.last_runs].sort((a, b) => b.started_at.localeCompare(a.started_at))[0];
  return (
    <dl className="grid grid-cols-1 overflow-hidden rounded-lg border sm:grid-cols-2 xl:grid-cols-4 [&>div]:border-b [&>div]:p-3 sm:[&>div]:border-r xl:[&>div]:border-b-0">
      <div>
        <dt className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">Publisher</dt>
        <dd className="mt-1 text-sm">
          {source.publisher ?? "—"}
          {host ? <span className="ml-1.5 font-mono text-xs text-muted-foreground">{host}</span> : null}
        </dd>
      </div>
      <div>
        <dt className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">Schedule</dt>
        <dd className="mt-1 text-sm">{source.schedule ?? "—"}</dd>
        {lastRun ? (
          <dd className="mt-0.5 text-xs text-muted-foreground">
            Last {lastRun.stage} run {lastRun.status}, {formatDateTime(lastRun.started_at)}
          </dd>
        ) : null}
      </div>
      <div>
        <dt className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">Snapshots</dt>
        <dd className="mt-1 text-sm tabular-nums">
          {formatCount(source.snapshots)} folders · {formatCount(source.files)} files · {formatBytes(source.bytes)}
        </dd>
        <dd className="mt-0.5 text-xs text-muted-foreground">{formatDtRange(source.first_dt, source.last_dt)}</dd>
      </div>
      <div>
        <dt className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">Feeds</dt>
        <dd className="mt-1 space-y-0.5">
          {source.datasets.length === 0 ? <span className="text-sm text-muted-foreground">No dataset</span> : null}
          {source.datasets.map((d) => (
            <span key={d.name} className="flex items-center gap-1.5 font-mono text-xs">
              <LoadDot loaded={d.loaded} />
              {d.loaded ? (
                <Link href={`/data/tables/${d.name}`} className="text-basecast-brand hover:underline">
                  {d.name}
                </Link>
              ) : (
                <span title="Declared by the pipeline, not loaded yet">{d.name}</span>
              )}
              {d.target === "bigquery" ? (
                <span className="rounded bg-muted px-1 text-[10px] text-muted-foreground">BQ</span>
              ) : null}
            </span>
          ))}
        </dd>
      </div>
    </dl>
  );
}

/** A folder of the bucket: the bucket root, a layer, a source (`source=`), a snapshot (`dt=`). */
export function FolderView({ lakeKey }: { lakeKey: string }) {
  const prefix = folderPrefix(lakeKey);
  const parts = parseKey(lakeKey);
  const isSource = Boolean(parts.sourceId) && !parts.dt;
  const sources = useLakeSources();
  const source = sources.data?.items.find((s) => s.source_id === parts.sourceId);
  const [view, setView] = useQueryState("view", parseAsStringLiteral(["tree", "list"] as const).withDefault("tree"));
  const [q, setQ] = useQueryState("q", parseAsString.withDefault(""));
  const [open, setOpen] = useState<Set<string>>(new Set());

  const searching = isSource && (q.trim() !== "" || view === "list");
  const listing = useLakeList(prefix);
  const flat = useLakeList(prefix, { q: q.trim(), recursive: true, enabled: searching });

  const folders = listing.data?.folders ?? [];
  // A source opens with its newest snapshot expanded.
  const newest = folders[0]?.prefix;
  const isOpen = (f: Folder) => (open.has(f.prefix) ? true : open.has(`-${f.prefix}`) ? false : f.prefix === newest);
  const toggle = (f: Folder) =>
    setOpen((prev) => {
      const next = new Set(prev);
      const was = isOpen(f);
      next.delete(f.prefix);
      next.delete(`-${f.prefix}`);
      next.add(was ? `-${f.prefix}` : f.prefix);
      return next;
    });

  const title = source ? source.name : lakeKey.split("/").at(-1) || "Bucket";
  const crumbs = [{ label: "Data", href: "/data" }, { label: parts.sourceId ?? (lakeKey || "Bucket") }];
  if (parts.dt) crumbs.push({ label: `dt=${parts.dt}` });

  return (
    <div className="space-y-4">
      <PageBreadcrumb items={crumbs} />
      <LakeCrumbs lakeKey={lakeKey} />
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold">{title}</h2>
          {source ? (
            <p className="line-clamp-2 max-w-3xl text-sm text-muted-foreground" title={source.description || undefined}>
              {source.description}
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">
              {listing.data ? `${folders.length} folders · ${formatCount(listing.data.total_objects)} files` : ""}
            </p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {isSource ? (
            <>
              <div className="relative">
                <SearchIcon className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={q}
                  onChange={(e) => void setQ(e.target.value || null)}
                  placeholder="Filter files"
                  aria-label="Filter files"
                  className="h-9 w-60 pl-8"
                />
              </div>
              <ViewSwitchControl
                value={view}
                onValueChange={(v) => void setView(v)}
                ariaLabel="How to show the files"
                options={[
                  { value: "tree", label: "Folders", ariaLabel: "By snapshot folder", icon: GitBranchIcon },
                  { value: "list", label: "All files", ariaLabel: "Every file", icon: ListIcon },
                ]}
              />
            </>
          ) : null}
          {source?.upstream_url ? (
            <Button asChild variant="outline" size="sm">
              <a href={source.upstream_url} target="_blank" rel="noopener noreferrer">
                <ExternalLinkIcon />
                Source
              </a>
            </Button>
          ) : null}
        </div>
      </div>

      {source ? <SourceFacts source={source} /> : null}
      {isSource && !searching ? <SnapshotTimeline folders={folders} /> : null}

      {listing.isPending ? (
        <Skeleton className="h-80 w-full" />
      ) : listing.isError ? (
        <EmptyState Icon={FolderXIcon} title="This folder could not be listed" description={listing.error.message} />
      ) : searching ? (
        flat.isPending ? (
          <Skeleton className="h-80 w-full" />
        ) : (
          <ListingTable showFolder>
            {(flat.data?.objects ?? []).map((o) => (
              <FileRow key={o.key} object={o} showFolder />
            ))}
            {flat.data && flat.data.objects.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-sm text-muted-foreground">
                  No file matches “{q}”.
                </td>
              </tr>
            ) : null}
          </ListingTable>
        )
      ) : folders.length === 0 && (listing.data?.objects.length ?? 0) === 0 ? (
        <EmptyState Icon={FolderXIcon} title="This folder is empty" compact />
      ) : (
        <ListingTable>
          {folders.map((f) =>
            isSource ? (
              <Fragment key={f.prefix}>
                <FolderRow folder={f} open={isOpen(f)} onToggle={() => toggle(f)} />
                {isOpen(f) ? <FolderFiles folder={f} /> : null}
              </Fragment>
            ) : (
              <FolderRow key={f.prefix} folder={f} />
            ),
          )}
          {(listing.data?.objects ?? []).map((o) => (
            <FileRow key={o.key} object={o} />
          ))}
        </ListingTable>
      )}
    </div>
  );
}
