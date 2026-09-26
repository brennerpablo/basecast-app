"use client";

import { Handle, type Node, type NodeProps, Position } from "@xyflow/react";
import { memo, type ReactNode } from "react";

import { RunDot } from "@/components/data-browser/file-kind";
import { formatBytes, formatCount } from "@/components/data-browser/format";
import { formatDuration } from "@/components/data-browser/runs-view";
import { cn } from "@/lib/utils";

import type { FlowNode, LatestRun } from "./graph";
import { HealthIcon } from "./health-icon";
import { healthLine, KIND } from "./labels";

export type FlowNodeData = {
  node: FlowNode;
  now: number;
  hasIn: boolean;
  hasOut: boolean;
  /** Off the selected node's lineage. */
  dim: boolean;
};
export type FlowRFNode = Node<FlowNodeData, "flow">;

const plural = (n: number, word: string) => `${formatCount(n)} ${word}${n === 1 ? "" : "s"}`;

const handleClass = "size-2! min-w-0! rounded-full! border-[1.5px]! border-muted-foreground/60! bg-card!";

function Row({ children, mono }: { children: ReactNode; mono?: boolean }) {
  return (
    <p className={cn("truncate text-[10.5px] leading-[15px] text-muted-foreground tabular-nums", mono && "font-mono")}>
      {children}
    </p>
  );
}

function RunRow({ run }: { run: LatestRun | null }) {
  if (!run) return <Row>No process run recorded</Row>;
  return (
    <Row>
      <RunDot status={run.status} /> <span className="font-medium text-foreground">{run.status}</span>
      {run.duration_s != null ? ` · ${formatDuration(run.duration_s)}` : ""}
      {run.rows != null ? ` · ${plural(run.rows, "row")}` : ""}
    </Row>
  );
}

function Tag({ children }: { children: ReactNode }) {
  return (
    <span className="ml-auto rounded border bg-card px-1 text-[9px] font-semibold tracking-wide text-muted-foreground">
      {children}
    </span>
  );
}

function body(node: FlowNode): { tag?: string; title: string; titleMono?: boolean; sub?: string; rows: ReactNode[] } {
  switch (node.kind) {
    case "origin":
      return { tag: node.group, title: node.label, rows: [<Row key="n">{plural(node.sources, "source")}</Row>] };
    case "ingest": {
      const s = node.source;
      return {
        tag: s.formats[0],
        title: s.name,
        sub: s.id,
        rows: [
          <Row key="s">{s.schedule ?? "Manual"}</Row>,
          <Row key="f">
            <span className="font-medium text-foreground">{plural(s.files, "file")}</span> · {formatBytes(s.bytes)} ·{" "}
            {plural(s.snapshots, "snapshot")}
          </Row>,
        ],
      };
    }
    case "process": {
      const s = node.source;
      const run = s.latestProcess;
      return {
        tag: s.inLake ? undefined : "no raw files",
        title: s.id,
        titleMono: true,
        rows: [
          <RunRow key="r" run={run} />,
          <Row key="f">
            {run?.files != null ? `${plural(run.files, "file")} read · ${formatCount(run.files_skipped ?? 0)} skipped` : "—"}
          </Row>,
        ],
      };
    }
    case "pipeline": {
      const s = node.source;
      return {
        tag: s.inLake ? s.formats[0] : "no raw files",
        title: s.name,
        sub: s.id,
        rows: [
          <Row key="s">{s.schedule ?? "Manual"}</Row>,
          <Row key="f">
            {s.inLake ? (
              <>
                <span className="font-medium text-foreground">{plural(s.files, "file")}</span> · {formatBytes(s.bytes)}
              </>
            ) : (
              "Reads files kept outside the lake"
            )}
          </Row>,
          <RunRow key="r" run={s.latestProcess} />,
        ],
      };
    }
    default: {
      const t = node.table;
      const rows = t.loaded ? (
        <>
          <span className="font-medium text-foreground">
            {t.rows_estimated ? "≈ " : ""}
            {formatCount(t.rows)}
          </span>{" "}
          rows
        </>
      ) : (
        <span className="font-medium text-foreground">not loaded</span>
      );
      const origin = node.external
        ? "From another origin group"
        : node.kind === "derived" && node.inputs
          ? `Reads ${plural(node.inputs.length, "table")}`
          : `Written by ${t.sources.join(", ")}`;
      return {
        tag: t.engine === "bigquery" ? "BigQuery" : "Postgres",
        title: t.name,
        titleMono: true,
        rows: [
          <Row key="r">
            {rows} · {t.mode ?? "—"}
            {t.bytes ? ` · ${formatBytes(t.bytes)}` : ""}
          </Row>,
          <Row key="o">{origin}</Row>,
        ],
      };
    }
  }
}

function FlowNodeCard({ data, selected, width, height }: NodeProps<FlowRFNode>) {
  const { node, now, hasIn, hasOut, dim } = data;
  const kind = KIND[node.kind];
  const content = body(node);
  const unloaded = (node.kind === "table" || node.kind === "derived") && !node.table.loaded;

  return (
    <div
      style={{ width, height, ["--kc" as string]: kind.color }}
      className={cn(
        "flex cursor-pointer flex-col gap-0.5 overflow-hidden rounded-lg border bg-card px-2.5 py-2 text-left shadow-xs transition-[opacity,box-shadow,border-color]",
        "hover:border-muted-foreground/50",
        node.kind === "origin" && "bg-muted",
        node.kind === "derived" && "bg-(--basecast-brand-surface)",
        unloaded && "border-dashed bg-muted/40",
        node.kind !== "origin" && "external" in node && node.external && "border-dotted border-[1.5px]",
        selected && "border-(--basecast-brand) shadow-md ring-2 ring-(--basecast-brand)",
        dim && "opacity-25",
      )}
    >
      {hasIn ? <Handle type="target" position={Position.Left} isConnectable={false} className={handleClass} /> : null}
      <div className="flex items-center gap-1.5 text-[9.5px] leading-[14px] font-semibold tracking-wider whitespace-nowrap text-(--kc) uppercase">
        <kind.Icon className="size-3 shrink-0" aria-hidden />
        {kind.label}
        {content.tag ? <Tag>{content.tag}</Tag> : null}
      </div>
      <p
        title={content.title}
        className={cn(
          "truncate text-[12.5px] leading-[17px] font-semibold text-foreground",
          content.titleMono && "font-mono text-[12px]",
        )}
      >
        {content.title}
      </p>
      {content.sub ? <Row mono>{content.sub}</Row> : null}
      {content.rows}
      <p title={node.health.reason} className="mt-auto flex min-w-0 items-center gap-1 text-[10.5px] leading-4 font-medium">
        <HealthIcon status={node.health.status} />
        <span className="truncate">{healthLine(node, now)}</span>
      </p>
      {hasOut ? <Handle type="source" position={Position.Right} isConnectable={false} className={handleClass} /> : null}
    </div>
  );
}

export const nodeTypes = { flow: memo(FlowNodeCard) };
