/**
 * The dataset flow as a graph: origin (publisher) → ingest (raw fetch) → process (parser) → tables →
 * derived tables. Built from `/lake/sources`, `/tables` and `/pipeline/runs`; no layout, no React.
 */

import type { Schemas, SourceSummary, TableSummary } from "@/components/data-browser/api";

import { type HealthVerdict, stageHealth, type StageRun, worstHealth } from "./health";

type Run = Schemas["Run"];

/** The origin groups of `/lake/sources`, in the order the filter shows them; others follow by name. */
export const FLOW_GROUPS = ["ERCOT", "Census", "EIA", "PUCT", "Weather", "Texas", "Other"];

/** The origin of pipelines that have no raw files in the lake (`config_facts` reads YAML from basecast-airflow). */
export const OUTSIDE_LAKE = "Outside the lake";

export type FlowKind = "origin" | "ingest" | "process" | "pipeline" | "table" | "derived";
export type FlowSteps = "split" | "merged";
export type DerivedLinks = "inputs" | "pipeline";
export type FlowOptions = { group: string | null; steps: FlowSteps; derived: DerivedLinks };

/** A source's latest process run; the run history adds the counts `last_runs` lacks. */
export type LatestRun = StageRun & Partial<Pick<Run, "duration_s" | "rows" | "files" | "files_skipped" | "error">>;

/** One pipeline source with the health of its two stages. */
export type FlowSource = {
  id: string;
  name: string;
  group: string;
  publisher: string | null;
  description: string | null;
  upstreamUrl: string | null;
  schedule: string | null;
  cron: string | null;
  files: number;
  bytes: number;
  snapshots: number;
  firstDt: string | null;
  lastDt: string | null;
  fetchedAt: string | null;
  formats: string[];
  /** False for a pipeline that tables name but the lake index does not know (no raw files). */
  inLake: boolean;
  /** The stage that writes its tables: `process` for the parsers, `model` for the marts (outside the lake). */
  writeStage: "process" | "model";
  latestRaw: LatestRun | null;
  latestProcess: LatestRun | null;
  ingest: HealthVerdict;
  process: HealthVerdict;
};

type NodeBase = { id: string; health: HealthVerdict };
export type OriginNode = NodeBase & { kind: "origin"; label: string; group: string; sources: number; unhealthy: number };
export type StepNode = NodeBase & { kind: "ingest" | "process" | "pipeline"; source: FlowSource };
export type TableNode = NodeBase & {
  kind: "table" | "derived";
  table: TableSummary;
  /** The tables a derived table reads, when get-data sends them. */
  inputs: string[] | null;
  /** Shown only because a derived table of this group reads it. */
  external: boolean;
};
export type FlowNode = OriginNode | StepNode | TableNode;
export type FlowEdge = { id: string; source: string; target: string; running: boolean };

export type FlowGraph = {
  nodes: FlowNode[];
  edges: FlowEdge[];
  byId: Map<string, FlowNode>;
  up: Map<string, string[]>;
  down: Map<string, string[]>;
};

/** The input tables of a derived table: SQL-derived tables and the marts (`inputs`, contract §6). */
export function tableInputs(table: TableSummary): string[] | null {
  return table.inputs?.length ? table.inputs : null;
}

/** Derived from other tables: built by SQL, or declaring its input tables whatever its write mode (the marts). */
const isDerived = (table: TableSummary) => table.mode === "sql" || tableInputs(table) !== null;

type StageRuns = { latest: LatestRun | null; lastSuccessAt: string | null };

/** Latest run and last success per `source:stage`, from the run history and each source's `last_runs`. */
function indexRuns(runs: Run[], sources: SourceSummary[]): Map<string, StageRuns> {
  const index = new Map<string, StageRuns>();
  const note = (source: string, run: LatestRun & { stage: string }) => {
    const key = `${source}:${run.stage}`;
    const entry = index.get(key) ?? { latest: null, lastSuccessAt: null };
    if (!entry.latest || run.started_at > entry.latest.started_at) entry.latest = run;
    if (run.status === "success") {
      const at = run.finished_at ?? run.started_at;
      if (!entry.lastSuccessAt || at > entry.lastSuccessAt) entry.lastSuccessAt = at;
    }
    index.set(key, entry);
  };
  for (const run of runs) note(run.source, run);
  for (const source of sources) for (const run of source.last_runs) note(source.source_id, run);
  return index;
}

/** Every pipeline source: the lake's, plus the ones only tables name. Health is computed at `now`. */
export function collectSources(
  sources: SourceSummary[],
  tables: TableSummary[],
  runs: Run[],
  now: Date,
): FlowSource[] {
  const runIndex = indexRuns(runs, sources);
  const stage = (id: string, name: string): StageRuns => runIndex.get(`${id}:${name}`) ?? { latest: null, lastSuccessAt: null };

  const out: FlowSource[] = sources.map((s) => {
    const raw = stage(s.source_id, "raw");
    const process = stage(s.source_id, "process");
    return {
      id: s.source_id,
      name: s.name,
      group: s.group,
      publisher: s.publisher ?? null,
      description: s.description ?? null,
      upstreamUrl: s.upstream_url ?? null,
      schedule: s.schedule ?? null,
      cron: s.schedule_cron ?? null,
      files: s.files,
      bytes: s.bytes,
      snapshots: s.snapshots,
      firstDt: s.first_dt ?? null,
      lastDt: s.last_dt ?? null,
      fetchedAt: s.last_fetched_at ?? null,
      formats: s.formats.map((f) => f.extension),
      inLake: true,
      writeStage: "process",
      latestRaw: raw.latest,
      latestProcess: process.latest,
      ingest: stageHealth({
        cron: s.schedule_cron,
        latest: raw.latest,
        lastSuccessAt: s.last_fetched_at ?? raw.lastSuccessAt,
        now,
      }),
      process: stageHealth({ cron: s.schedule_cron, latest: process.latest, lastSuccessAt: process.lastSuccessAt, now }),
    };
  });

  const known = new Set(out.map((s) => s.id));
  const extra = [...new Set(tables.flatMap((t) => t.sources))].filter((id) => !known.has(id)).sort();
  for (const id of extra) {
    // Outside the lake a pipeline either parses files kept elsewhere (`process`) or builds the marts (`model`).
    const parse = stage(id, "process");
    const model = stage(id, "model");
    const writeStage = (model.latest?.started_at ?? "") > (parse.latest?.started_at ?? "") ? "model" : "process";
    const process = writeStage === "model" ? model : parse;
    const health = stageHealth({ cron: null, latest: process.latest, lastSuccessAt: process.lastSuccessAt, now });
    out.push({
      id,
      name: id,
      group: "Other",
      publisher: null,
      description: null,
      upstreamUrl: null,
      schedule: null,
      cron: null,
      files: 0,
      bytes: 0,
      snapshots: 0,
      firstDt: null,
      lastDt: null,
      fetchedAt: null,
      formats: [],
      inLake: false,
      writeStage,
      latestRaw: null,
      latestProcess: process.latest,
      ingest: health,
      process: health,
    });
  }
  return out;
}

/** The health of a source as one node: both stages, or only processing when nothing is ingested. */
export function pipelineHealth(source: FlowSource): HealthVerdict {
  return source.inLake ? worstHealth([source.ingest, source.process]) : source.process;
}

const groupRank = (group: string) => {
  const i = FLOW_GROUPS.indexOf(group);
  return i === -1 ? FLOW_GROUPS.length : i;
};

/** The groups with their source counts, in filter order. */
export function flowGroups(sources: FlowSource[]): { group: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const s of sources) counts.set(s.group, (counts.get(s.group) ?? 0) + 1);
  return [...counts.entries()]
    .map(([group, count]) => ({ group, count }))
    .sort((a, b) => groupRank(a.group) - groupRank(b.group) || a.group.localeCompare(b.group));
}

const isUnhealthy = (h: HealthVerdict) => h.status !== "healthy" && h.status !== "running";

export function buildFlow(sources: FlowSource[], tables: TableSummary[], options: FlowOptions): FlowGraph {
  const included = sources
    .filter((s) => !options.group || s.group === options.group)
    .sort(
      (a, b) =>
        groupRank(a.group) - groupRank(b.group) ||
        (a.publisher ?? "~").localeCompare(b.publisher ?? "~") ||
        a.id.localeCompare(b.id),
    );
  const bySource = new Map(included.map((s) => [s.id, s]));
  const allSources = new Map(sources.map((s) => [s.id, s]));
  const tableByName = new Map(tables.map((t) => [t.name, t]));
  const merged = options.steps === "merged";

  const nodes = new Map<string, FlowNode>();
  const edges = new Map<string, FlowEdge>();
  const link = (source: string, target: string, running = false) =>
    edges.set(`${source}>${target}`, { id: `${source}>${target}`, source, target, running });
  const stepId = (id: string) => `${merged ? "pipeline" : "process"}:${id}`;

  const origins = new Map<string, FlowSource[]>();
  for (const s of included) {
    const label = s.publisher ?? OUTSIDE_LAKE;
    origins.set(label, [...(origins.get(label) ?? []), s]);
  }
  for (const [label, list] of origins) {
    const verdicts = list.map(pipelineHealth);
    nodes.set(`origin:${label}`, {
      id: `origin:${label}`,
      kind: "origin",
      label,
      group: list[0].group,
      sources: list.length,
      unhealthy: verdicts.filter(isUnhealthy).length,
      health: worstHealth(verdicts),
    });
  }

  for (const s of included) {
    const origin = `origin:${s.publisher ?? OUTSIDE_LAKE}`;
    if (merged) {
      nodes.set(stepId(s.id), { id: stepId(s.id), kind: "pipeline", source: s, health: pipelineHealth(s) });
      link(origin, stepId(s.id));
    } else if (!s.inLake) {
      nodes.set(stepId(s.id), { id: stepId(s.id), kind: "process", source: s, health: s.process });
      link(origin, stepId(s.id));
    } else {
      nodes.set(`ingest:${s.id}`, { id: `ingest:${s.id}`, kind: "ingest", source: s, health: s.ingest });
      nodes.set(stepId(s.id), { id: stepId(s.id), kind: "process", source: s, health: s.process });
      link(origin, `ingest:${s.id}`, s.latestRaw?.status === "running");
      link(`ingest:${s.id}`, stepId(s.id));
    }
  }

  const tableHealth = (t: TableSummary): HealthVerdict => {
    if (!t.loaded) return { status: "never", reason: "Declared but not loaded yet.", updatedAt: null, dueAt: null };
    const writers = t.sources.map((id) => allSources.get(id)).filter((s): s is FlowSource => Boolean(s));
    const verdicts = writers.map((s) => (writers.length > 1 ? { ...s.process, reason: `${s.id}: ${s.process.reason}` } : s.process));
    return worstHealth(verdicts);
  };
  const addTable = (t: TableSummary, external: boolean) => {
    const id = `table:${t.name}`;
    if (nodes.has(id)) return;
    nodes.set(id, {
      id,
      kind: isDerived(t) ? "derived" : "table",
      table: t,
      inputs: tableInputs(t),
      external,
      health: tableHealth(t),
    });
  };

  const shown = tables
    .filter((t) => t.kind === "dataset" && t.sources.some((id) => bySource.has(id)))
    .sort((a, b) => Number(isDerived(a)) - Number(isDerived(b)) || a.name.localeCompare(b.name));
  for (const t of shown) addTable(t, false);
  for (const t of shown) {
    const inputs = tableInputs(t);
    if (inputs && options.derived === "inputs") {
      for (const name of inputs) {
        const input = tableByName.get(name);
        if (!input) continue;
        addTable(input, true);
        link(`table:${name}`, `table:${t.name}`);
      }
      continue;
    }
    for (const id of t.sources) {
      const s = bySource.get(id);
      if (s) link(stepId(id), `table:${t.name}`, s.latestProcess?.status === "running");
    }
  }
  // Ingest → process runs while the process runs.
  for (const s of included) {
    if (!merged && s.inLake && s.latestProcess?.status === "running") link(`ingest:${s.id}`, stepId(s.id), true);
  }

  const graph: FlowGraph = {
    nodes: [...nodes.values()],
    edges: [...edges.values()],
    byId: nodes,
    up: new Map(),
    down: new Map(),
  };
  for (const n of graph.nodes) {
    graph.up.set(n.id, []);
    graph.down.set(n.id, []);
  }
  for (const e of graph.edges) {
    graph.down.get(e.source)?.push(e.target);
    graph.up.get(e.target)?.push(e.source);
  }
  return graph;
}

function walk(start: string, adjacency: Map<string, string[]>): Set<string> {
  const seen = new Set<string>();
  const stack = [start];
  while (stack.length) {
    const id = stack.pop()!;
    for (const next of adjacency.get(id) ?? []) {
      if (!seen.has(next)) {
        seen.add(next);
        stack.push(next);
      }
    }
  }
  return seen;
}

/** Everything upstream and downstream of a node, and the edges on those paths. */
export function lineage(graph: FlowGraph, id: string): { up: Set<string>; down: Set<string>; nodes: Set<string>; edges: Set<string> } {
  const up = walk(id, graph.up);
  const down = walk(id, graph.down);
  const upSide = new Set([id, ...up]);
  const downSide = new Set([id, ...down]);
  const edges = new Set(
    graph.edges
      .filter((e) => (upSide.has(e.source) && upSide.has(e.target)) || (downSide.has(e.source) && downSide.has(e.target)))
      .map((e) => e.id),
  );
  return { up, down, nodes: new Set([id, ...up, ...down]), edges };
}

/** The name a node goes by in search, the panel and neighbor chips. */
export function nodeLabel(node: FlowNode): string {
  switch (node.kind) {
    case "origin":
      return node.label;
    case "process":
      return node.source.id;
    case "ingest":
    case "pipeline":
      return node.source.name;
    default:
      return node.table.name;
  }
}

/** The same node under the other step mode (`process:x` ↔ `pipeline:x`), so a selection survives the switch. */
export function nodeIdForSteps(id: string, steps: FlowSteps): string {
  return steps === "merged" ? id.replace(/^(ingest|process):/, "pipeline:") : id.replace(/^pipeline:/, "process:");
}
