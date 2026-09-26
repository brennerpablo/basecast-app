/** The JSON the /api/ops routes answer with; dates are ISO strings in UTC. */

export const OPS_RANGES = ["1h", "24h", "7d", "30d"] as const;
export type OpsRange = (typeof OPS_RANGES)[number];

export const OPS_SERVICES = ["app", "get-data", "airflow"] as const;
export type OpsService = (typeof OPS_SERVICES)[number];

export const OPS_LEVELS = ["info", "warn", "error"] as const;
export type OpsLevel = (typeof OPS_LEVELS)[number];

/** `idle`: no request in the last hour, which for a demo app is not an outage. */
export type HealthStatus = "healthy" | "degraded" | "idle" | "stalled";

export type RequestServiceHealth = {
  service: "app" | "get-data";
  status: HealthStatus;
  reason: string;
  requests: number;
  errors5xx: number;
  p95Ms: number | null;
  lastAt: string | null;
  version: string | null;
  host: string | null;
};

export type PipelineHealth = {
  status: HealthStatus;
  reason: string;
  runs: number;
  failed: number;
  rows: number;
  lastAt: string | null;
  /** Sources whose latest run failed or was abandoned. */
  failing: { source: string; stage: string; status: string; startedAt: string }[];
  /** The latest runs, oldest first, for the strip on the card. */
  recent: { source: string; status: string; durationS: number | null }[];
};

export type TrafficPoint = {
  bucket: string;
  service: "app" | "get-data";
  ok: number;
  e4: number;
  e5: number;
  p95Ms: number | null;
};

export type TopError = {
  /** The fingerprint, or `service:event` for an error line without one. */
  key: string;
  service: OpsService;
  errorClass: string | null;
  message: string;
  place: string | null;
  count: number;
  firstAt: string;
  lastAt: string;
};

export type PipelineDay = { source: string; day: string; status: string; runs: number };

export type OpsOverview = {
  range: OpsRange;
  /** The server's clock when it answered; the charts' last bucket and the grid's last day. */
  generatedAt: string;
  since: string;
  bucketMs: number;
  services: RequestServiceHealth[];
  pipelines: PipelineHealth;
  traffic: TrafficPoint[];
  topErrors: TopError[];
  pipelineDays: PipelineDay[];
};

export type RouteStats = {
  service: "app" | "get-data";
  method: string;
  route: string;
  requests: number;
  e4: number;
  e5: number;
  p50Ms: number | null;
  p95Ms: number | null;
  p99Ms: number | null;
  maxMs: number | null;
};

export type EtlRunRow = {
  runId: string;
  source: string;
  stage: string;
  dagId: string | null;
  tryNumber: number | null;
  startedAt: string;
  finishedAt: string | null;
  durationS: number | null;
  status: string;
  rows: number | null;
  files: number | null;
  error: string | null;
  /** The source and stage's median duration over 30 days, for the "slower than usual" bar. */
  medianS: number | null;
};

export type EtlRunDetail = {
  run: EtlRunRow & { events: unknown; params: unknown };
  logs: OpsLogEntry[];
};

export type OpsLogEntry = {
  id: string;
  ts: string;
  service: OpsService;
  env: string;
  level: OpsLevel;
  event: string;
  message: string;
  requestId: string | null;
  runId: string | null;
  userId: string | null;
  method: string | null;
  route: string | null;
  status: number | null;
  durationMs: number | null;
  errorClass: string | null;
  errorStack: string | null;
  fingerprint: string | null;
  version: string | null;
  host: string | null;
  context: Record<string, unknown> | null;
};

export type OpsLogPage = {
  entries: OpsLogEntry[];
  /** Lines per level in the range with the other filters applied, for the level chips. */
  levelCounts: Record<OpsLevel, number>;
  /** Pass as `before` for the next page; null on the last one. */
  nextBefore: string | null;
};
