"use client";

import "@xyflow/react/dist/style.css";

import {
  Background,
  BackgroundVariant,
  ControlButton,
  Controls,
  type Edge,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  useStore,
} from "@xyflow/react";
import { MoveHorizontalIcon, NetworkIcon, SearchIcon } from "lucide-react";
import { parseAsString, parseAsStringLiteral, useQueryStates } from "nuqs";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { ViewSwitchControl } from "@/components/components-app/ui/view-switch-control";
import { useLakeSources, useRuns, useTables } from "@/components/data-browser/api";
import { formatBytes, formatCount } from "@/components/data-browser/format";
import EmptyState from "@/components/empty-state";
import { PANEL_ENTER, PANEL_EXIT, usePresence } from "@/components/motion/presence";
import { PageBreadcrumb } from "@/components/page-breadcrumb";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useTheme } from "@/lib/hooks/use-theme";
import { cn } from "@/lib/utils";

import { FlowPanel } from "./flow-panel";
import {
  buildFlow,
  collectSources,
  type FlowGraph,
  flowGroups,
  type FlowNode,
  lineage,
  nodeIdForSteps,
  nodeLabel,
  pipelineHealth,
  tableInputs,
} from "./graph";
import { DATA_HEALTH, type DataHealth } from "./health";
import { HealthIcon } from "./health-icon";
import { HEALTH_LABEL, KIND, KIND_COLOR_VARS } from "./labels";
import { layoutFlow } from "./layout";
import { type FlowNodeData, type FlowRFNode, nodeTypes } from "./nodes";

const STEPS = ["split", "merged"] as const;
const DERIVED = ["inputs", "pipeline"] as const;
const flowParams = {
  node: parseAsString,
  group: parseAsString,
  steps: parseAsStringLiteral(STEPS).withDefault("split"),
  derived: parseAsStringLiteral(DERIVED).withDefault("inputs"),
};

/** Width of the details panel; the view centers a node in what the panel leaves visible. */
const PANEL_WIDTH = 344;

/** React Flow's own colors, mapped to the app's tokens so both themes follow. */
const FLOW_THEME =
  "[--xy-background-color:transparent] [--xy-edge-stroke:hsl(var(--muted-foreground)/0.45)] " +
  "[--xy-minimap-background-color:hsl(var(--card))] [--xy-minimap-mask-background-color:hsl(var(--foreground)/0.06)] " +
  "[--xy-minimap-mask-stroke-color:hsl(var(--foreground)/0.35)] [--xy-controls-button-background-color:hsl(var(--card))] " +
  "[--xy-controls-button-background-color-hover:hsl(var(--muted))] [--xy-controls-button-color:hsl(var(--foreground))] " +
  "[--xy-controls-button-color-hover:hsl(var(--foreground))] [--xy-controls-button-border-color:hsl(var(--border))] " +
  "[--xy-attribution-background-color:transparent]";

/** Re-render every minute so "updated 3 h ago" and the overdue checks stay true. */
function useNow(intervalMs = 60_000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs]);
  return now;
}

/** /data/flow: every origin, the steps that ingest and process it, the tables they write and when each last updated. */
export function FlowView() {
  return (
    <ReactFlowProvider>
      <FlowScreen />
    </ReactFlowProvider>
  );
}

function FlowScreen() {
  const [params, setParams] = useQueryStates(flowParams);
  const sources = useLakeSources();
  const tables = useTables();
  const runs = useRuns(null);
  const now = useNow();

  const flowSources = useMemo(
    () =>
      sources.data && tables.data
        ? collectSources(sources.data.items, tables.data.items, runs.data?.items ?? [], new Date(now))
        : [],
    [sources.data, tables.data, runs.data, now],
  );
  const tableItems = useMemo(() => tables.data?.items ?? [], [tables.data]);
  const options = useMemo(
    () => ({ group: params.group, steps: params.steps, derived: params.derived }),
    [params.group, params.steps, params.derived],
  );
  const graph = useMemo(() => buildFlow(flowSources, tableItems, options), [flowSources, tableItems, options]);
  const layout = useMemo(() => layoutFlow(graph), [graph]);
  const groups = useMemo(() => flowGroups(flowSources), [flowSources]);
  const hasInputs = useMemo(() => tableItems.some((t) => tableInputs(t) !== null), [tableItems]);

  const { setCenter, getZoom } = useReactFlow();
  const paneWidth = useStore((s) => s.width);
  const centerOn = useCallback(
    (id: string, duration = 300) => {
      const box = layout.positions.get(id);
      if (!box) return;
      const zoom = Math.max(getZoom(), 0.8);
      const shift = paneWidth >= 768 ? PANEL_WIDTH / 2 / zoom : 0;
      void setCenter(box.x + box.width / 2 + shift, box.y + box.height / 2, { zoom, duration });
    },
    [layout, getZoom, setCenter, paneWidth],
  );

  const select = useCallback(
    (id: string | null, center = false) => {
      void setParams({ node: id });
      if (id && center) centerOn(id);
    },
    [setParams, centerOn],
  );

  const selected = params.node && graph.byId.has(params.node) ? graph.byId.get(params.node)! : null;
  const panel = usePresence(selected);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = e.target instanceof HTMLElement && e.target.closest("input, textarea, select, [contenteditable]");
      if (typing) return;
      if (e.key === "Escape" && params.node) void setParams({ node: null });
      if (e.key === "/") {
        e.preventDefault();
        document.getElementById("flow-search")?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [params.node, setParams]);

  const header = (
    <>
      <PageBreadcrumb items={[{ label: "Data", href: "/data" }, { label: "Flow" }]} />
      <div>
        <h2 className="text-lg font-semibold">Dataset flow</h2>
        <p className="text-sm text-muted-foreground">
          Every origin, the pipeline that ingests and processes it, the tables it writes and when each last updated. Select a
          node to trace everything upstream and downstream of it.
        </p>
      </div>
    </>
  );

  if (sources.isPending || tables.isPending) {
    return (
      <div className="space-y-4">
        {header}
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-[520px] w-full" />
      </div>
    );
  }
  if (sources.isError || tables.isError) {
    const error = sources.error ?? tables.error;
    return (
      <div className="space-y-4">
        {header}
        <EmptyState Icon={NetworkIcon} title="The dataset flow could not be read" description={error?.message} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {header}
      <FlowSummary
        sources={flowSources.length}
        origins={new Set(flowSources.map((s) => s.publisher)).size}
        tables={tableItems.filter((t) => t.kind === "dataset")}
        files={sources.data.totals.files}
        bytes={sources.data.totals.bytes}
        health={flowSources.map((s) => pipelineHealth(s).status)}
      />

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border bg-card px-3 py-2">
        <FlowSearch graph={graph} onPick={(id) => select(id, true)} />
        <div className="min-w-0 overflow-x-auto">
          <ViewSwitchControl
            size="sm"
            ariaLabel="Origin group"
            value={params.group ?? "all"}
            onValueChange={(v) => void setParams({ group: v === "all" ? null : v })}
            options={[
              { value: "all", label: `All ${flowSources.length}` },
              ...groups.map((g) => ({ value: g.group, label: `${g.group} ${g.count}` })),
            ]}
          />
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 lg:ml-auto">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            ETL steps
            <ViewSwitchControl
              size="sm"
              ariaLabel="ETL steps"
              value={params.steps}
              onValueChange={(v) =>
                void setParams({ steps: v, node: params.node ? nodeIdForSteps(params.node, v) : null })
              }
              options={[
                { value: "split", label: "Ingest + process" },
                { value: "merged", label: "One node" },
              ]}
            />
          </div>
          {hasInputs ? (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              Derived from
              <ViewSwitchControl
                size="sm"
                ariaLabel="Link derived tables to"
                value={params.derived}
                onValueChange={(v) => void setParams({ derived: v })}
                options={[
                  { value: "inputs", label: "Input tables" },
                  { value: "pipeline", label: "Pipeline" },
                ]}
              />
            </div>
          ) : null}
        </div>
      </div>

      <div
        className={cn(
          "relative h-[calc(100svh-17rem)] min-h-[520px] overflow-hidden rounded-lg border bg-muted/20",
          KIND_COLOR_VARS,
        )}
      >
        <FlowCanvas
          graph={graph}
          layout={layout}
          fitKey={`${params.group ?? "all"}|${params.steps}|${params.derived}`}
          selected={selected?.id ?? null}
          now={now}
          onSelect={(id) => select(id)}
          centerOn={centerOn}
        />
        <Legend />
        {panel.shown ? (
          <SelectedPanel
            graph={graph}
            node={panel.shown}
            now={now}
            onSelect={(id) => select(id, true)}
            onClose={() => select(null)}
            motion={panel.closing ? PANEL_EXIT : PANEL_ENTER}
          />
        ) : null}
      </div>
    </div>
  );
}

function SelectedPanel({
  graph,
  node,
  now,
  onSelect,
  onClose,
  motion,
}: {
  graph: FlowGraph;
  node: FlowNode;
  now: number;
  onSelect: (id: string) => void;
  onClose: () => void;
  /** The enter or exit classes (`PANEL_ENTER`, `PANEL_EXIT`). */
  motion: string;
}) {
  const path = useMemo(() => lineage(graph, node.id), [graph, node.id]);
  return (
    <FlowPanel
      graph={graph}
      node={node}
      upstream={path.up.size}
      downstream={path.down.size}
      now={now}
      onSelect={onSelect}
      onClose={onClose}
      className={cn("absolute z-10 max-md:inset-x-3 max-md:bottom-3 max-md:max-h-[60%] md:top-3 md:right-3 md:bottom-[172px] md:w-[344px]", motion)}
    />
  );
}

function FlowCanvas({
  graph,
  layout,
  fitKey,
  selected,
  now,
  onSelect,
  centerOn,
}: {
  graph: FlowGraph;
  layout: ReturnType<typeof layoutFlow>;
  fitKey: string;
  selected: string | null;
  now: number;
  onSelect: (id: string | null) => void;
  centerOn: (id: string, duration?: number) => void;
}) {
  const { setViewport } = useReactFlow();
  const width = useStore((s) => s.width);
  const { resolvedTheme } = useTheme();
  const path = useMemo(() => (selected ? lineage(graph, selected) : null), [graph, selected]);

  const nodes = useMemo<FlowRFNode[]>(
    () =>
      graph.nodes.map((n) => {
        const box = layout.positions.get(n.id)!;
        const data: FlowNodeData = {
          node: n,
          now,
          hasIn: (graph.up.get(n.id)?.length ?? 0) > 0,
          hasOut: (graph.down.get(n.id)?.length ?? 0) > 0,
          dim: path !== null && !path.nodes.has(n.id),
        };
        return {
          id: n.id,
          type: "flow",
          position: { x: box.x, y: box.y },
          width: box.width,
          height: box.height,
          draggable: false,
          connectable: false,
          selected: n.id === selected,
          data,
        };
      }),
    [graph, layout, path, selected, now],
  );

  const edges = useMemo<Edge[]>(
    () =>
      graph.edges.map((e) => {
        const lit = path?.edges.has(e.id) ?? false;
        return {
          id: e.id,
          source: e.source,
          target: e.target,
          animated: e.running,
          selectable: false,
          focusable: false,
          zIndex: lit ? 1 : 0,
          style: lit ? { stroke: "var(--basecast-brand)", strokeWidth: 2 } : path ? { opacity: 0.12 } : undefined,
        };
      }),
    [graph, path],
  );

  const fitWidth = useCallback(() => {
    if (!width) return;
    const zoom = Math.min(1, Math.max(0.1, (width - 48) / layout.width));
    void setViewport({ x: Math.max(24, (width - layout.width * zoom) / 2), y: 12, zoom }, { duration: 200 });
  }, [width, layout.width, setViewport]);

  // A new layout (group, steps) starts fitted to the width from the top, or on the selected node.
  const fitted = useRef<string | null>(null);
  useEffect(() => {
    if (!width || fitted.current === fitKey) return;
    fitted.current = fitKey;
    if (selected) centerOn(selected, 0);
    else {
      const zoom = Math.min(1, Math.max(0.1, (width - 48) / layout.width));
      void setViewport({ x: Math.max(24, (width - layout.width * zoom) / 2), y: 12, zoom });
    }
  }, [fitKey, width, layout.width, selected, centerOn, setViewport]);

  return (
    <ReactFlow<FlowRFNode>
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      onNodeClick={(_, node) => onSelect(node.id)}
      onPaneClick={() => onSelect(null)}
      nodesDraggable={false}
      nodesConnectable={false}
      elementsSelectable={false}
      panOnScroll
      zoomOnDoubleClick={false}
      minZoom={0.05}
      maxZoom={1.5}
      onlyRenderVisibleElements
      colorMode={resolvedTheme === "dark" ? "dark" : "light"}
      className={FLOW_THEME}
    >
      <Background variant={BackgroundVariant.Dots} gap={16} size={1} color="hsl(var(--border))" />
      <Controls showInteractive={false} fitViewOptions={{ padding: 0.04 }}>
        <ControlButton onClick={fitWidth} title="Fit the width" aria-label="Fit the width">
          <MoveHorizontalIcon />
        </ControlButton>
      </Controls>
      <MiniMap
        pannable
        zoomable
        nodeBorderRadius={3}
        nodeColor={(n) => KIND[(n.data as FlowNodeData).node.kind].color}
        className="overflow-hidden rounded-md border max-md:hidden!"
        ariaLabel="Minimap"
      />
    </ReactFlow>
  );
}

function FlowSearch({ graph, onPick }: { graph: FlowGraph; onPick: (id: string) => void }) {
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const [open, setOpen] = useState(false);
  const needle = query.trim().toLowerCase();
  const matches = useMemo(
    () =>
      needle
        ? graph.nodes.filter((n) => `${nodeLabel(n)} ${n.id}`.toLowerCase().includes(needle)).slice(0, 8)
        : [],
    [graph, needle],
  );
  const pick = (id: string) => {
    onPick(id);
    setOpen(false);
  };

  return (
    <div className="relative w-full sm:w-64">
      <SearchIcon className="pointer-events-none absolute top-2.5 left-2.5 size-3.5 text-muted-foreground" aria-hidden />
      <Input
        id="flow-search"
        type="search"
        value={query}
        placeholder="Find a source or table"
        aria-label="Find a source or table"
        autoComplete="off"
        className="h-8 pl-8 text-sm"
        onChange={(e) => {
          setQuery(e.target.value);
          setActive(0);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 120)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown" || e.key === "ArrowUp") {
            e.preventDefault();
            if (matches.length) setActive((a) => (a + (e.key === "ArrowDown" ? 1 : matches.length - 1)) % matches.length);
          } else if (e.key === "Enter" && matches[active]) {
            pick(matches[active].id);
          } else if (e.key === "Escape") {
            setQuery("");
            setOpen(false);
          }
        }}
      />
      {open && needle ? (
        <div role="listbox" className="absolute top-9 right-0 left-0 z-30 min-w-72 rounded-md border bg-popover p-1 shadow-lg">
          {matches.length === 0 ? (
            <p className="px-2 py-1.5 text-xs text-muted-foreground">Nothing here matches. Try the All group.</p>
          ) : (
            matches.map((n, i) => (
              <button
                key={n.id}
                type="button"
                role="option"
                aria-selected={i === active}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => pick(n.id)}
                style={{ ["--kc" as string]: KIND[n.kind].color }}
                className={cn(
                  "flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs",
                  i === active ? "bg-muted" : "hover:bg-muted/60",
                )}
              >
                <span className="w-16 shrink-0 text-[9.5px] font-semibold tracking-wider text-(--kc) uppercase">
                  {KIND[n.kind].label.split(" ")[0]}
                </span>
                <span className="truncate">{nodeLabel(n)}</span>
                <HealthIcon status={n.health.status} className="ml-auto size-3" />
              </button>
            ))
          )}
        </div>
      ) : null}
    </div>
  );
}

function FlowSummary({
  sources,
  origins,
  tables,
  files,
  bytes,
  health,
}: {
  sources: number;
  origins: number;
  tables: { mode?: string | null }[];
  files: number;
  bytes: number;
  health: DataHealth[];
}) {
  const derived = tables.filter((t) => t.mode === "sql").length;
  const counts = DATA_HEALTH.map((status) => ({ status, count: health.filter((h) => h === status).length })).filter(
    (c) => c.count > 0,
  );
  const stats: [string, string][] = [
    [formatCount(origins), "origins"],
    [formatCount(sources), "pipelines"],
    [formatCount(tables.length), `tables · ${derived} derived`],
    [formatCount(files), "raw files"],
    [formatBytes(bytes), "in the lake"],
  ];
  return (
    <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-3">
      <dl className="flex flex-wrap gap-x-6 gap-y-2">
        {stats.map(([value, label]) => (
          <div key={label} className="flex flex-col">
            <dd className="text-lg leading-tight font-semibold tabular-nums">{value}</dd>
            <dt className="text-[11px] text-muted-foreground">{label}</dt>
          </div>
        ))}
      </dl>
      <ul className="flex flex-wrap gap-2" aria-label="Pipeline health">
        {counts.map(({ status, count }) => (
          <li key={status} className="flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs">
            <HealthIcon status={status} />
            <span className="font-semibold tabular-nums">{count}</span>
            <span className="text-muted-foreground">{HEALTH_LABEL[status].toLowerCase()}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Legend() {
  const kinds = (["origin", "ingest", "process", "table", "derived"] as const).map((k) => ({ k, ...KIND[k] }));
  return (
    <div className="pointer-events-none absolute bottom-3 left-14 z-5 hidden max-w-[calc(100%-300px)] flex-wrap gap-x-3 gap-y-1 rounded-md border bg-card/90 px-2.5 py-1.5 text-[11px] text-muted-foreground xl:flex">
      {kinds.map(({ k, label, Icon, color }) => (
        <span key={k} className="inline-flex items-center gap-1" style={{ color }}>
          <Icon className="size-3" aria-hidden />
          <span className="text-muted-foreground">{label.split(" ·")[0]}</span>
        </span>
      ))}
      {(["healthy", "running", "stale", "failed", "never"] as const).map((status) => (
        <span key={status} className="inline-flex items-center gap-1">
          <HealthIcon status={status} className="size-3" />
          {HEALTH_LABEL[status].toLowerCase()}
        </span>
      ))}
    </div>
  );
}
