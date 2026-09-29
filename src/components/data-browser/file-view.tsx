"use client";

import { CopyIcon, ExternalLinkIcon, FileWarningIcon, FileXIcon } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import EmptyState from "@/components/empty-state";
import { PageBreadcrumb } from "@/components/page-breadcrumb";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

import { type FileKind, type ObjectDetail, useLakeObject } from "./api";
import { FileKindIcon, LoadDot } from "./file-kind";
import { formatBytes, formatCount, formatDateTime, middleTruncate } from "./format";
import { copyText, LakeCrumbs } from "./lake-crumbs";
import { lakeHref, sourceKey } from "./lake-path";

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

/**
 * One raw file: where it came from and the tables it fed. The static demo keeps the lake's catalog, not its
 * files, so there is no preview or download.
 */
export function FileView({ lakeKey }: { lakeKey: string }) {
  const detail = useLakeObject(lakeKey);
  const object = detail.data?.object;
  const kind: FileKind | undefined = object?.kind;
  const fileName = object?.file ?? lakeKey.split("/").at(-1) ?? "";

  if (detail.isError) {
    return (
      <div className="space-y-4">
        <PageBreadcrumb items={[{ label: "Data", href: "/data" }, { label: fileName }]} />
        <LakeCrumbs lakeKey={lakeKey} />
        <EmptyState Icon={FileXIcon} title="This file is not in the lake" description={detail.error.message} />
      </div>
    );
  }

  const badges = [
    fileName.split(".").at(-1)?.toUpperCase(),
    object ? formatBytes(object.bytes) : null,
    object?.dt ? `dt=${object.dt}` : null,
  ].filter(Boolean) as string[];

  return (
    <div className="space-y-4">
      <PageBreadcrumb
        items={[
          { label: "Data", href: "/data" },
          ...(object?.source_id ? [{ label: object.source_id, href: lakeHref(sourceKey(object.source_id)) }] : []),
          { label: fileName },
        ]}
      />
      <LakeCrumbs lakeKey={lakeKey} />

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          {kind ? <FileKindIcon kind={kind} className="mt-0.5 size-8" /> : <Skeleton className="size-8" />}
          <div className="min-w-0 space-y-1.5">
            <h2 className="font-mono text-[15px] font-semibold break-all">{fileName}</h2>
            <div className="flex flex-wrap gap-1.5">
              {badges.map((b) => (
                <span key={b} className="rounded-md border px-2 py-0.5 text-[11px] text-muted-foreground">
                  {b}
                </span>
              ))}
            </div>
          </div>
        </div>
        {object?.url ? (
          <Button asChild variant="outline" size="sm">
            <a href={object.url} target="_blank" rel="noopener noreferrer">
              <ExternalLinkIcon />
              Open at source
            </a>
          </Button>
        ) : null}
      </div>

      <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-[minmax(0,1fr)_300px]">
        <section className="min-w-0 overflow-hidden rounded-lg border">
          <div className="border-b px-4 py-2.5">
            <h3 className="text-sm font-semibold">Preview</h3>
          </div>
          <div className="py-12">
            <EmptyState
              Icon={FileWarningIcon}
              title="No file previews in this demo"
              description="The static snapshot keeps the lake's catalog, not its files."
              compact
            />
          </div>
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
