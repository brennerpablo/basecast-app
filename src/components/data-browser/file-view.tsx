"use client";

import {
  ArrowLeftIcon,
  CopyIcon,
  DownloadIcon,
  ExternalLinkIcon,
  FileWarningIcon,
  FileXIcon,
  GitBranchIcon,
  TableIcon,
} from "lucide-react";
import Link from "next/link";
import { parseAsString, parseAsStringLiteral, useQueryState } from "nuqs";
import type { ReactNode } from "react";

import { ViewSwitchControl } from "@/components/components-app/ui/view-switch-control";
import EmptyState from "@/components/empty-state";
import { PageBreadcrumb } from "@/components/page-breadcrumb";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

import { type FileKind, fileUrl, type ObjectDetail, type ObjectStructure, useLakeObject, useObjectStructure } from "./api";
import { FileKindIcon, LoadDot } from "./file-kind";
import { formatBytes, formatCount, formatDateTime, middleTruncate } from "./format";
import { copyText, LakeCrumbs } from "./lake-crumbs";
import { LakeGrid } from "./lake-grid";
import { LAKE_BUCKET, lakeHref, sourceKey } from "./lake-path";
import { PdfPreview } from "./pdf-preview";
import { JsonTree, TextBlocks, ZipMembers } from "./previews";

function Panel({ title, children, aside }: { title: string; children: ReactNode; aside?: ReactNode }) {
  return (
    <section className="rounded-lg border p-4">
      <h3 className="mb-3 flex items-center justify-between gap-2 text-sm font-semibold">
        {title}
        {aside}
      </h3>
      {children}
    </section>
  );
}

function Row({ label, children, title }: { label: string; children: ReactNode; title?: string }) {
  return (
    <div className="grid grid-cols-[104px_minmax(0,1fr)] gap-2 text-[13px]">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="truncate" title={title}>
        {children}
      </dd>
    </div>
  );
}

function Details({ detail }: { detail: ObjectDetail }) {
  const o = detail.object;
  const meta = Object.entries(o.meta ?? {}).filter(([, v]) => v !== null && v !== "" && typeof v !== "object");
  return (
    <Panel title="Details">
      <dl className="space-y-2">
        <Row label="Source">
          <Link href={lakeHref(sourceKey(o.source_id))} className="font-mono text-basecast-brand hover:underline">
            {o.source_id}
          </Link>
        </Row>
        {o.dt ? (
          <Row label="Folder">
            <Link href={lakeHref(`raw/source=${o.source_id}/dt=${o.dt}`)} className="font-mono hover:underline">
              dt={o.dt}
            </Link>
          </Row>
        ) : null}
        <Row label="Size">{formatCount(o.bytes)} bytes</Row>
        <Row label="Fetched">{formatDateTime(o.fetched_at)}</Row>
        {o.sha256 ? (
          <Row label="SHA-256" title={o.sha256}>
            <button
              type="button"
              onClick={() => void copyText(o.sha256 ?? "", "SHA-256")}
              className="inline-flex items-center gap-1 font-mono text-xs hover:text-basecast-brand"
            >
              {o.sha256.slice(0, 16)}…
              <CopyIcon className="size-3" />
            </button>
          </Row>
        ) : null}
        {o.http_status ? <Row label="HTTP">{o.http_status}</Row> : null}
        {o.content_type ? <Row label="Content type">{o.content_type}</Row> : null}
        {o.doc_id ? <Row label="Document id">{o.doc_id}</Row> : null}
        {o.report_type_id ? <Row label="Report type">{o.report_type_id}</Row> : null}
        {o.last_modified ? <Row label="Modified">{o.last_modified}</Row> : null}
        {meta.map(([k, v]) => (
          <Row key={k} label={k.replace(/_/g, " ")} title={String(v)}>
            <span className="font-mono text-xs">{String(v)}</span>
          </Row>
        ))}
      </dl>
    </Panel>
  );
}

function Provenance({ detail }: { detail: ObjectDetail }) {
  const o = detail.object;
  const links = [
    o.url ? { label: "File URL", href: o.url } : null,
    o.source_page && o.source_page !== o.url ? { label: "Listed on", href: o.source_page } : null,
    !o.url && detail.source.upstream_url ? { label: "Source page", href: detail.source.upstream_url } : null,
  ].filter((l): l is { label: string; href: string } => l !== null);
  if (links.length === 0) return null;
  return (
    <Panel title="Provenance">
      <ul className="space-y-2">
        {links.map((l) => (
          <li key={l.label}>
            <a
              href={l.href}
              target="_blank"
              rel="noopener noreferrer"
              className="flex flex-col gap-0.5 rounded-md border px-3 py-2 text-xs transition-colors hover:border-basecast-brand"
            >
              <span className="flex items-center gap-1.5 font-medium">
                <ExternalLinkIcon className="size-3" />
                {l.label}
              </span>
              <span className="break-all text-muted-foreground">{middleTruncate(l.href, 96)}</span>
            </a>
          </li>
        ))}
      </ul>
    </Panel>
  );
}

function Lineage({ detail }: { detail: ObjectDetail }) {
  const processed = new Map(detail.processed.map((p) => [p.dataset, p]));
  const datasets = detail.datasets;
  return (
    <Panel title="Loaded into">
      {datasets.length === 0 ? (
        <p className="text-[13px] text-muted-foreground">No dataset reads this source.</p>
      ) : (
        <ul className="space-y-2">
          {datasets.map((d) => {
            const p = processed.get(d.name);
            const line = p
              ? `${formatCount(p.rows)} rows from this file · v${p.version} · ${formatDateTime(p.processed_at)}${p.current ? "" : " · file changed since"}`
              : d.mode === "sql"
                ? `Derived by SQL · ${d.loaded ? "loaded" : "not loaded yet"}`
                : d.loaded
                  ? "Not read from this file"
                  : "Not loaded yet";
            const body = (
              <>
                <span className="flex items-center gap-1.5 font-mono text-xs font-medium">
                  <LoadDot loaded={d.loaded} />
                  {d.name}
                  {d.target === "bigquery" ? <span className="rounded bg-muted px-1 text-[10px] text-muted-foreground">BQ</span> : null}
                </span>
                <span className="text-[11px] text-muted-foreground">{line}</span>
              </>
            );
            return (
              <li key={d.name}>
                {d.loaded ? (
                  <Link
                    href={`/data/tables/${d.name}`}
                    className="flex flex-col gap-0.5 rounded-md border px-3 py-2 transition-colors hover:border-basecast-brand hover:bg-basecast-brand-surface"
                  >
                    {body}
                  </Link>
                ) : (
                  <div className="flex flex-col gap-0.5 rounded-md border border-dashed px-3 py-2">{body}</div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
  );
}

function OtherSnapshots({ detail }: { detail: ObjectDetail }) {
  if (detail.other_snapshots.length === 0) return null;
  return (
    <Panel title="Other snapshots" aside={<span className="text-xs font-normal text-muted-foreground">{detail.other_snapshots.length}</span>}>
      <ul className="divide-y divide-dashed">
        {detail.other_snapshots.slice(0, 12).map((s) => (
          <li key={s.key}>
            <Link href={lakeHref(s.key)} className="flex items-center justify-between gap-2 py-1.5 text-xs hover:text-basecast-brand">
              <span className="truncate font-mono" title={s.file}>
                {middleTruncate(s.file.replace(/^RPT\.[0-9.]+\./, ""), 40)}
              </span>
              <span className="shrink-0 font-mono text-muted-foreground">{s.dt}</span>
            </Link>
          </li>
        ))}
      </ul>
    </Panel>
  );
}

function SheetTabs({ sheets, current, onPick }: { sheets: ObjectStructure["sheets"]; current: string; onPick: (name: string) => void }) {
  return (
    <div className="grid-scrollbar flex overflow-x-auto border-t bg-muted/40" role="tablist" aria-label="Sheets">
      {(sheets ?? []).map((s) => (
        <button
          key={s.name}
          type="button"
          role="tab"
          aria-selected={s.name === current}
          onClick={() => onPick(s.name)}
          title={s.rows !== null && s.rows !== undefined ? `${formatCount(s.rows)} rows × ${s.columns} columns` : undefined}
          className={cn(
            "shrink-0 border-r px-3 py-1.5 text-xs whitespace-nowrap transition-colors hover:bg-accent",
            s.name === current
              ? "bg-background font-semibold text-foreground shadow-[inset_0_2px_0_var(--color-brand-hover)]"
              : "text-muted-foreground",
          )}
        >
          {s.name}
        </button>
      ))}
    </div>
  );
}

function Preview({
  lakeKey,
  member,
  kind,
  previewable,
  structure,
}: {
  lakeKey: string;
  member: string | null;
  kind: FileKind;
  previewable: boolean;
  structure: ReturnType<typeof useObjectStructure>;
}) {
  const [sheet, setSheet] = useQueryState("sheet", parseAsString);
  const [mode, setMode] = useQueryState("mode", parseAsStringLiteral(["table", "tree"] as const).withDefault("table"));
  const download = (
    <Button asChild variant="outline" size="sm">
      <a href={fileUrl(lakeKey, member, true)}>
        <DownloadIcon />
        Download
      </a>
    </Button>
  );

  if (!previewable && kind !== "pdf") {
    return (
      <div className="flex flex-col items-center gap-3 py-12">
        <EmptyState Icon={FileWarningIcon} title="Too large to preview here" compact />
        {download}
      </div>
    );
  }
  if (kind === "pdf") return <PdfPreview url={fileUrl(lakeKey, member)} />;
  if (kind === "slides" || kind === "document" || kind === "html") return <TextBlocks lakeKey={lakeKey} member={member} />;
  if (kind === "other") {
    return (
      <div className="flex flex-col items-center gap-3 py-12">
        <EmptyState Icon={FileWarningIcon} title="No preview for this format" compact />
        {download}
      </div>
    );
  }
  if (structure.isPending) return <Skeleton className="h-[62vh] w-full rounded-none" />;
  if (structure.isError) {
    return <EmptyState Icon={FileXIcon} title="This file could not be read" description={structure.error.message} />;
  }
  const s = structure.data;
  if (s.too_large) {
    return (
      <div className="flex flex-col items-center gap-3 py-12">
        <EmptyState Icon={FileWarningIcon} title="Too large to preview here" description={s.note ?? undefined} compact />
        {download}
      </div>
    );
  }
  if (kind === "zip") return <ZipMembers lakeKey={lakeKey} members={s.members ?? []} />;
  if (kind === "sheet") {
    const current = sheet && s.sheets?.some((x) => x.name === sheet) ? sheet : (s.sheets?.[0]?.name ?? null);
    return (
      <div className="flex flex-col">
        <LakeGrid lakeKey={lakeKey} member={member} sheet={current} className="h-[60vh] min-h-[400px] rounded-none border-0" />
        <SheetTabs sheets={s.sheets} current={current ?? ""} onPick={(name) => void setSheet(name === s.sheets?.[0]?.name ? null : name)} />
      </div>
    );
  }
  if ((kind === "json" || kind === "geojson") && s.json_tree) {
    if (!s.columns) return <JsonTree node={s.json_tree} />;
    return (
      <div className="flex flex-col">
        <div className="flex items-center justify-between gap-2 border-b px-3 py-1.5 text-xs text-muted-foreground">
          <span>
            {formatCount(s.row_count)} rows from <span className="font-mono">{s.tabular_path}</span>
          </span>
          <ViewSwitchControl
            size="sm"
            value={mode}
            onValueChange={(v) => void setMode(v === "table" ? null : v)}
            ariaLabel="Table or tree"
            options={[
              { value: "table", label: "Table", icon: TableIcon },
              { value: "tree", label: "Tree", icon: GitBranchIcon },
            ]}
          />
        </div>
        {mode === "tree" ? (
          <JsonTree node={s.json_tree} />
        ) : (
          <LakeGrid lakeKey={lakeKey} member={member} className="h-[58vh] min-h-[400px] rounded-none border-0" />
        )}
      </div>
    );
  }
  if (kind === "text" || kind === "parquet") {
    return <LakeGrid lakeKey={lakeKey} member={member} className="h-[62vh] min-h-[420px] rounded-none border-0" />;
  }
  return <EmptyState Icon={FileWarningIcon} title="No preview for this format" compact />;
}

/** One raw file: its preview, where it came from, and the tables it fed. */
export function FileView({ lakeKey }: { lakeKey: string }) {
  const [member] = useQueryState("member", parseAsString);
  const detail = useLakeObject(lakeKey);
  const object = detail.data?.object;
  const isZip = object?.kind === "zip";
  const zip = useObjectStructure(lakeKey, null, Boolean(isZip && member));
  const memberInfo = member ? zip.data?.members?.find((m) => m.name === member) : undefined;
  const kind: FileKind | undefined = member ? memberInfo?.kind : object?.kind;
  const needsStructure = Boolean(kind && !["pdf", "slides", "document", "html", "other"].includes(kind));
  const structure = useObjectStructure(lakeKey, member, Boolean(detail.data?.previewable) && needsStructure);

  const fileName = object?.file ?? lakeKey.split("/").at(-1) ?? "";
  const shownName = member ? (member.split("/").at(-1) ?? member) : fileName;

  if (detail.isError) {
    return (
      <div className="space-y-4">
        <PageBreadcrumb items={[{ label: "Data", href: "/data" }, { label: fileName }]} />
        <LakeCrumbs lakeKey={lakeKey} />
        <EmptyState Icon={FileXIcon} title="This file is not in the lake" description={detail.error.message} />
      </div>
    );
  }

  const s = structure.data;
  const badges = [
    (member ? shownName : fileName).split(".").at(-1)?.toUpperCase(),
    memberInfo ? formatBytes(memberInfo.bytes) : object ? formatBytes(object.bytes) : null,
    s?.sheets ? `${s.sheets.length} sheets` : null,
    s?.members ? `${s.members.length} members` : null,
    s?.row_count !== null && s?.row_count !== undefined && kind !== "sheet" ? `${formatCount(s.row_count)} rows` : null,
    s?.delimiter ? `delimiter ${s.delimiter === "\t" ? "tab" : s.delimiter}` : null,
    object?.dt ? `dt=${object.dt}` : null,
  ].filter(Boolean) as string[];

  return (
    <div className="space-y-4">
      <PageBreadcrumb
        items={[
          { label: "Data", href: "/data" },
          ...(object?.source_id ? [{ label: object.source_id, href: lakeHref(sourceKey(object.source_id)) }] : []),
          { label: shownName },
        ]}
      />
      <LakeCrumbs lakeKey={lakeKey} />

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          {kind ? <FileKindIcon kind={kind} className="mt-0.5 size-8" /> : <Skeleton className="size-8" />}
          <div className="min-w-0 space-y-1.5">
            {member ? (
              <Link href={lakeHref(lakeKey)} className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
                <ArrowLeftIcon className="size-3" />
                <span className="font-mono">{middleTruncate(fileName, 60)}</span>
              </Link>
            ) : null}
            <h2 className="font-mono text-[15px] font-semibold break-all">{shownName}</h2>
            <div className="flex flex-wrap gap-1.5">
              {badges.map((b) => (
                <span key={b} className="rounded-md border px-2 py-0.5 text-[11px] text-muted-foreground">
                  {b}
                </span>
              ))}
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {object?.url ? (
            <Button asChild variant="outline" size="sm">
              <a href={object.url} target="_blank" rel="noopener noreferrer">
                <ExternalLinkIcon />
                Open at source
              </a>
            </Button>
          ) : null}
          <Button asChild variant="outline" size="sm">
            <a href={fileUrl(lakeKey, member, true)}>
              <DownloadIcon />
              Download
            </a>
          </Button>
          <Button variant="outline" size="sm" onClick={() => void copyText(`${LAKE_BUCKET}/${lakeKey}`, "gs:// URI")}>
            <CopyIcon />
            gs:// URI
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-[minmax(0,1fr)_300px]">
        <section className="min-w-0 overflow-hidden rounded-lg border">
          <div className="border-b px-4 py-2.5">
            <h3 className="text-sm font-semibold">Preview</h3>
          </div>
          {!kind ? (
            <Skeleton className="h-[62vh] w-full rounded-none" />
          ) : (
            <Preview
              lakeKey={lakeKey}
              member={member}
              kind={kind}
              previewable={detail.data?.previewable ?? true}
              structure={structure}
            />
          )}
        </section>
        <aside className="space-y-4">
          {detail.data ? (
            <>
              <Details detail={detail.data} />
              <Provenance detail={detail.data} />
              <Lineage detail={detail.data} />
              <OtherSnapshots detail={detail.data} />
            </>
          ) : (
            <Skeleton className="h-96 w-full" />
          )}
        </aside>
      </div>
    </div>
  );
}
