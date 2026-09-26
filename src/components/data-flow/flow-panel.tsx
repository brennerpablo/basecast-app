"use client";

import { ArrowRightIcon, ExternalLinkIcon, XIcon } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { RunDot } from "@/components/data-browser/file-kind";
import { formatBytes, formatCount, formatDateTime, formatDtRange } from "@/components/data-browser/format";
import { lakeHref, sourceKey } from "@/components/data-browser/lake-path";
import { formatDuration } from "@/components/data-browser/runs-view";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { type FlowGraph, type FlowNode, type FlowSource, nodeLabel } from "./graph";
import type { HealthVerdict } from "./health";
import { HealthIcon } from "./health-icon";
import { formatAgo, HEALTH_LABEL, KIND, MODE_TEXT } from "./labels";

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-1.5">
      <h3 className="text-[10.5px] font-semibold tracking-wider text-muted-foreground uppercase">{title}</h3>
      {children}
    </section>
  );
}

function Fields({ rows }: { rows: [string, ReactNode][] }) {
  return (
    <dl className="grid grid-cols-[6.5rem_minmax(0,1fr)] gap-x-3 gap-y-1 text-xs">
      {rows.map(([label, value]) => (
        <div key={label} className="contents">
          <dt className="text-muted-foreground">{label}</dt>
          <dd className="wrap-break-word tabular-nums">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function HealthBlock({ health, now, verb, schedule }: { health: HealthVerdict; now: number; verb: string; schedule?: string | null }) {
  return (
    <div className="space-y-2 rounded-md border bg-muted/40 p-2.5">
      <p className="flex items-center gap-1.5 text-sm font-semibold">
        <HealthIcon status={health.status} className="size-4" />
        {HEALTH_LABEL[health.status]}
      </p>
      <p className="text-xs text-muted-foreground">{health.reason}</p>
      <Fields
        rows={[
          [verb, health.updatedAt ? `${formatDateTime(health.updatedAt)} · ${formatAgo(health.updatedAt, now)}` : "—"],
          ...(schedule !== undefined ? ([["Schedule", schedule ?? "Manual"]] as [string, ReactNode][]) : []),
          ...(health.dueAt ? ([["Next due", formatDateTime(health.dueAt)]] as [string, ReactNode][]) : []),
        ]}
      />
    </div>
  );
}

function NodeChips({ graph, ids, onSelect }: { graph: FlowGraph; ids: string[]; onSelect: (id: string) => void }) {
  if (ids.length === 0) return <p className="text-xs text-muted-foreground">None.</p>;
  return (
    <div className="flex flex-wrap gap-1">
      {ids.map((id) => {
        const node = graph.byId.get(id);
        if (!node) return null;
        return (
          <button
            key={id}
            type="button"
            onClick={() => onSelect(id)}
            title={nodeLabel(node)}
            style={{ ["--kc" as string]: KIND[node.kind].color }}
            className="inline-flex max-w-full items-center gap-1.5 rounded-md border bg-card px-1.5 py-0.5 text-[11.5px] hover:border-muted-foreground/50"
          >
            <HealthIcon status={node.health.status} className="size-3" />
            <span className="truncate">{nodeLabel(node)}</span>
          </button>
        );
      })}
    </div>
  );
}

function AppLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-xs hover:border-muted-foreground/50 hover:bg-muted/50">
      <ArrowRightIcon className="size-3.5 shrink-0 text-(--basecast-brand)" aria-hidden />
      {children}
    </Link>
  );
}

function ExternalLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-xs hover:border-muted-foreground/50 hover:bg-muted/50"
    >
      <ExternalLinkIcon className="size-3.5 shrink-0 text-(--basecast-brand)" aria-hidden />
      <span className="flex-1">{children}</span>
      <span className="max-w-[55%] truncate font-mono text-[10.5px] text-muted-foreground">{href.replace(/^https?:\/\//, "")}</span>
    </a>
  );
}

function RunError({ error }: { error: string | null | undefined }) {
  if (!error) return null;
  return (
    <p className="rounded-md border border-red-300 bg-red-50 p-2 font-mono text-[11px] wrap-break-word text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
      {error}
    </p>
  );
}

function runStatus(status: string): ReactNode {
  return (
    <span className="inline-flex items-center gap-1.5">
      <RunDot status={status} />
      {status}
    </span>
  );
}

function ingestFields(s: FlowSource): [string, ReactNode][] {
  const run = s.latestRaw;
  return [
    ...(run
      ? ([
          ["Last run", runStatus(run.status)],
          ["Started", formatDateTime(run.started_at)],
        ] as [string, ReactNode][])
      : []),
    ["Snapshots", `${formatCount(s.snapshots)} · ${formatDtRange(s.firstDt, s.lastDt)}`],
    ["Raw files", `${formatCount(s.files)} · ${formatBytes(s.bytes)}`],
    ["Formats", s.formats.join(", ") || "—"],
  ];
}

function processFields(s: FlowSource): [string, ReactNode][] {
  const run = s.latestProcess;
  if (!run) return [["Last run", "None recorded"]];
  return [
    ["Last run", runStatus(run.status)],
    ["Started", formatDateTime(run.started_at)],
    ["Duration", formatDuration(run.duration_s)],
    ["Rows written", formatCount(run.rows)],
    ["Files", run.files != null ? `${formatCount(run.files)} read · ${formatCount(run.files_skipped ?? 0)} skipped` : "—"],
  ];
}

function Details({ graph, node, now }: { graph: FlowGraph; node: FlowNode; now: number }) {
  if (node.kind === "origin") {
    const urls = [
      ...new Set(
        (graph.down.get(node.id) ?? [])
          .map((id) => graph.byId.get(id))
          .map((n) => (n && "source" in n ? n.source.upstreamUrl : null))
          .filter((u): u is string => Boolean(u)),
      ),
    ];
    return (
      <>
        <HealthBlock health={node.health} now={now} verb="Last update" />
        {urls.length ? (
          <Section title="Upstream pages">
            <div className="space-y-1">
              {urls.slice(0, 8).map((url) => (
                <ExternalLink key={url} href={url}>
                  Open
                </ExternalLink>
              ))}
            </div>
          </Section>
        ) : null}
      </>
    );
  }

  if ("source" in node) {
    const s = node.source;
    return (
      <>
        {s.description ? <p className="text-xs leading-relaxed text-muted-foreground">{s.description}</p> : null}
        {node.kind !== "process" && s.inLake ? (
          <Section title="Ingest">
            <HealthBlock health={s.ingest} now={now} verb="Last fetch" schedule={s.schedule} />
            <Fields rows={ingestFields(s)} />
            <RunError error={s.latestRaw?.error} />
          </Section>
        ) : null}
        {node.kind !== "ingest" ? (
          <Section title="Process">
            <HealthBlock health={s.process} now={now} verb="Last update" schedule={node.kind === "process" ? s.schedule : undefined} />
            <Fields rows={processFields(s)} />
            <RunError error={s.latestProcess?.error} />
          </Section>
        ) : null}
        {!s.inLake ? (
          <p className="text-xs text-muted-foreground">
            No ingest step: this pipeline has no raw files in the lake (<span className="font-mono">config_facts</span> reads the
            YAML kept in basecast-airflow).
          </p>
        ) : null}
        <Section title="Open">
          <div className="space-y-1">
            {s.inLake ? <AppLink href={lakeHref(sourceKey(s.id))}>Raw files in the lake</AppLink> : null}
            {node.kind !== "ingest" ? <AppLink href={`/data/runs?source=${encodeURIComponent(s.id)}`}>Pipeline runs</AppLink> : null}
            {s.upstreamUrl ? <ExternalLink href={s.upstreamUrl}>Upstream page</ExternalLink> : null}
          </div>
        </Section>
      </>
    );
  }

  const t = node.table;
  const href = `/data/tables/${encodeURIComponent(t.name)}`;
  return (
    <>
      {t.description ? <p className="text-xs leading-relaxed text-muted-foreground">{t.description}</p> : null}
      <HealthBlock health={node.health} now={now} verb="Last update" />
      <Fields
        rows={[
          ["Rows", t.loaded ? `${t.rows_estimated ? "≈ " : ""}${formatCount(t.rows)}` : "Not loaded yet"],
          ["Size", formatBytes(t.bytes)],
          ["Write mode", <span key="m" className="font-mono">{t.mode ?? "—"}</span>],
          ["Built by", t.sources.join(", ")],
        ]}
      />
      {t.mode && MODE_TEXT[t.mode] ? <p className="text-xs text-muted-foreground">{MODE_TEXT[t.mode]}</p> : null}
      {node.external ? (
        <p className="text-xs text-muted-foreground">This table belongs to another origin group. Choose All to see where it comes from.</p>
      ) : null}
      <Section title="Open">
        <div className="space-y-1">
          <AppLink href={href}>Rows and schema</AppLink>
          <AppLink href={`${href}?tab=lineage`}>Raw files behind it</AppLink>
        </div>
      </Section>
    </>
  );
}

/** The details of the selected node, over the right edge of the canvas (a bottom sheet on phones). */
export function FlowPanel({
  graph,
  node,
  upstream,
  downstream,
  now,
  onSelect,
  onClose,
  className,
}: {
  graph: FlowGraph;
  node: FlowNode;
  upstream: number;
  downstream: number;
  now: number;
  onSelect: (id: string) => void;
  onClose: () => void;
  className?: string;
}) {
  const kind = KIND[node.kind];
  const sub =
    node.kind === "origin"
      ? node.group
      : "source" in node
        ? node.source.id
        : `${node.table.engine === "bigquery" ? "BigQuery" : "Postgres"} · ${node.table.location}`;
  const up = graph.up.get(node.id) ?? [];
  const down = graph.down.get(node.id) ?? [];
  const upTitle = node.kind === "derived" && node.inputs ? "Reads from" : node.kind === "table" || node.kind === "derived" ? "Written by" : "Upstream";
  const downTitle = node.kind === "ingest" ? "Processed by" : node.kind === "process" || node.kind === "pipeline" ? "Writes" : node.kind === "origin" ? "Sources" : "Feeds";

  return (
    <aside
      aria-label="Node details"
      className={cn("flex flex-col overflow-hidden rounded-lg border bg-card shadow-lg", className)}
      style={{ ["--kc" as string]: kind.color }}
    >
      <header className="relative space-y-0.5 border-b px-3.5 py-3">
        <p className="flex items-center gap-1.5 text-[10px] font-semibold tracking-wider text-(--kc) uppercase">
          <kind.Icon className="size-3" aria-hidden />
          {kind.label}
        </p>
        <h2 className="pr-8 text-[15px] leading-snug font-semibold wrap-break-word">{nodeLabel(node)}</h2>
        {sub ? <p className="font-mono text-[11px] break-all text-muted-foreground">{sub}</p> : null}
        <Button variant="ghost" size="icon" className="absolute top-2 right-2 size-7" onClick={onClose} aria-label="Close details">
          <XIcon className="size-4" />
        </Button>
      </header>
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-3.5 py-3">
        <Details graph={graph} node={node} now={now} />
        {node.kind !== "origin" ? (
          <Section title={upTitle}>
            <NodeChips graph={graph} ids={up} onSelect={onSelect} />
          </Section>
        ) : null}
        <Section title={downTitle}>
          <NodeChips graph={graph} ids={down} onSelect={onSelect} />
        </Section>
        <Section title="Lineage">
          <Fields
            rows={[
              ["Upstream", `${formatCount(upstream)} nodes`],
              ["Downstream", `${formatCount(downstream)} nodes`],
            ]}
          />
        </Section>
      </div>
    </aside>
  );
}
