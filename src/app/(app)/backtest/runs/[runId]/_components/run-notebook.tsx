"use client";

import {
  ArrowRight,
  Calendar,
  CircleCheck,
  CircleSlash,
  CircleX,
  Clock,
  Database,
  FlaskConical,
  GitCommitHorizontal,
  Layers,
  ListChecks,
  type LucideIcon,
  ScrollText,
  SearchX,
  Settings2,
  Table2,
} from "lucide-react";
import Link from "next/link";
import type * as React from "react";

import { AppBadge, type AppBadgeState } from "@/components/components-app/ui/badge";
import { Card } from "@/components/components-app/ui/card";
import type { TableDetail } from "@/components/data-browser/api";
import { formatDateTime } from "@/components/data-browser/format";
import { formatDuration } from "@/components/data-browser/runs-view";
import EmptyState from "@/components/empty-state";
import { PageBreadcrumb } from "@/components/page-breadcrumb";
import { formatWhole, GAP } from "@/components/product/format";
import { InfoTip } from "@/components/product/info-tip";
import { KpiStatCard, KpiStatItem } from "@/components/product/kpi-stat-card";
import { PageHeader } from "@/components/product/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { useProductQuery } from "@/lib/bff/queries";
import {
  checkDelta,
  checkValue,
  type MartCheck,
  martScreen,
  type MartStep,
  type ModelRun,
  shortRunId,
  stepsOf,
  tally,
} from "@/lib/model-runs";
import { useModelRun, useRunLogs } from "@/lib/model-runs-query";
import { cn } from "@/lib/utils";

const RUN_STATE: Record<string, AppBadgeState> = {
  success: "active",
  partial: "alert",
  failed: "critical",
  abandoned: "inactive",
  running: "processing",
};

const CHECK_ICON: Record<string, { Icon: LucideIcon; className: string; label: string }> = {
  passed: { Icon: CircleCheck, className: "text-emerald-600 dark:text-emerald-400", label: "Passed" },
  failed: { Icon: CircleX, className: "text-red-600 dark:text-red-400", label: "Failed" },
  skipped: { Icon: CircleSlash, className: "text-muted-foreground", label: "Skipped" },
};

/**
 * One notebook cell: the execution count in the gutter, as `[3]`, then a card with the cell's title and what it
 * returned on the right (a tally, a duration).
 */
function Cell({
  n,
  icon: Icon,
  title,
  mono,
  aside,
  tone,
  children,
}: {
  n: number | string;
  icon: LucideIcon;
  title: React.ReactNode;
  mono?: boolean;
  aside?: React.ReactNode;
  tone?: "failed" | "muted";
  children: React.ReactNode;
}) {
  return (
    <li className="grid grid-cols-[2.75rem_minmax(0,1fr)] gap-2 sm:grid-cols-[3.5rem_minmax(0,1fr)] sm:gap-3">
      <span className="pt-4 text-right font-mono text-xs text-muted-foreground tabular-nums select-none">[{n}]</span>
      <Card
        className={cn(
          "min-w-0 p-4 sm:p-5",
          tone === "failed" && "border-red-300 dark:border-red-900",
          tone === "muted" && "border-dashed bg-muted/20",
        )}
      >
        <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1.5">
          <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
          <h2 className={cn("text-sm font-semibold text-foreground", mono && "font-mono")}>{title}</h2>
          {aside && <div className="ml-auto flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">{aside}</div>}
        </div>
        {children}
      </Card>
    </li>
  );
}

/** The run's parameters, printed as the first cell of a notebook would set them. */
function ParamsBlock({ run }: { run: ModelRun }) {
  const lines: [string, string][] = [
    ["code", `"${run.code ?? "unknown"}"`],
    ["as_of", run.asOf ? `"${run.asOf}"` : "None"],
    ["dry_run", run.dryRun ? "True" : "False"],
    ["marts", `[${run.marts.map((m) => `"${m}"`).join(", ")}]`],
  ];
  return (
    <pre className="overflow-x-auto rounded-md border border-border bg-muted/40 p-3 font-mono text-xs leading-relaxed text-foreground">
      {lines.map(([key, value]) => (
        <div key={key}>
          <span className="text-basecast-brand">{key}</span> = {value}
        </div>
      ))}
    </pre>
  );
}

function TallyChips({ checks }: { checks: MartCheck[] }) {
  const t = tally(checks);
  if (!t.total) return <span>No checks</span>;
  return (
    <>
      <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400">
        <CircleCheck className="size-3.5" aria-hidden />
        {t.passed}
      </span>
      {t.failed > 0 && (
        <span className="inline-flex items-center gap-1 text-red-600 dark:text-red-400">
          <CircleX className="size-3.5" aria-hidden />
          {t.failed}
        </span>
      )}
      {t.skipped > 0 && (
        <span className="inline-flex items-center gap-1">
          <CircleSlash className="size-3.5" aria-hidden />
          {t.skipped}
        </span>
      )}
    </>
  );
}

/** The mart's checks as asserts: what the build expected, what it got, and the gap when they differ. */
function AssertTable({ checks }: { checks: MartCheck[] }) {
  if (!checks.length) return <p className="text-xs text-muted-foreground">No check declared for this mart.</p>;
  return (
    <div className="grid-scrollbar overflow-x-auto rounded-md border border-border">
      <table className="w-full text-xs">
        <thead className="bg-muted/50 text-left text-muted-foreground">
          <tr>
            <th className="w-8 px-2 py-1.5 font-medium">
              <span className="sr-only">Status</span>
            </th>
            <th className="px-2 py-1.5 font-medium">Check</th>
            <th className="px-2 py-1.5 text-right font-medium">Expected</th>
            <th className="px-2 py-1.5 text-right font-medium">Actual</th>
            <th className="px-2 py-1.5 text-right font-medium">Δ</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {checks.map((c, i) => {
            const look = CHECK_ICON[c.status] ?? CHECK_ICON.skipped;
            const delta = checkDelta(c);
            const note = c.reason ?? c.error;
            return (
              <tr key={`${c.check}-${i}`} className={cn(c.status === "failed" && "bg-red-50 dark:bg-red-950/30")}>
                <td className="px-2 py-1.5">
                  <look.Icon className={cn("size-3.5", look.className)} aria-label={look.label} />
                </td>
                <td className="px-2 py-1.5 text-foreground">{c.check}</td>
                {note && c.expected === undefined && c.actual === undefined ? (
                  <td colSpan={3} className="px-2 py-1.5 text-right text-muted-foreground italic">
                    {note}
                  </td>
                ) : (
                  <>
                    <td className="px-2 py-1.5 text-right font-mono tabular-nums">{checkValue(c.expected)}</td>
                    <td className="px-2 py-1.5 text-right font-mono tabular-nums">{checkValue(c.actual)}</td>
                    <td className="px-2 py-1.5 text-right font-mono text-muted-foreground tabular-nums">
                      {delta == null ? "" : `${delta > 0 ? "+" : ""}${checkValue(delta)}`}
                    </td>
                  </>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/** One mart of the run: what it is and reads (the registry), its asserts, and what it wrote. */
function MartCell({ n, step }: { n: number; step: MartStep }) {
  const table = useProductQuery<TableDetail>(`tables/${encodeURIComponent(step.mart)}`, undefined, { throwOnError: false });
  const detail = table.data?.data;
  const screen = martScreen(step.mart);
  const failed = step.checks.some((c) => c.status === "failed") || step.issues.length > 0;
  return (
    <Cell
      n={n}
      icon={Table2}
      title={step.mart}
      mono
      tone={failed ? "failed" : undefined}
      aside={
        <>
          <TallyChips checks={step.checks} />
          {step.built?.durationS != null && <span className="tabular-nums">· {formatDuration(step.built.durationS)}</span>}
        </>
      }
    >
      <div className="space-y-3">
        {detail?.description && <p className="text-xs text-muted-foreground">{detail.description}</p>}
        {!!detail?.inputs?.length && (
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            <span className="text-muted-foreground">Reads</span>
            {detail.inputs.map((input) => (
              <Link
                key={input}
                href={`/data/tables/${encodeURIComponent(input)}`}
                className="rounded border border-border bg-muted/40 px-1.5 py-0.5 font-mono text-[11px] text-foreground hover:border-basecast-brand hover:text-basecast-brand"
              >
                {input}
              </Link>
            ))}
          </div>
        )}
        <AssertTable checks={step.checks} />
        {step.issues.map((issue, i) => (
          <p key={i} className="flex items-start gap-1.5 text-xs text-red-600 dark:text-red-400">
            <CircleX className="mt-0.5 size-3.5 shrink-0" aria-hidden />
            <span>
              {issue.kind === "mart.skipped" ? "Not written: " : ""}
              {issue.text}
            </span>
          </p>
        ))}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-border pt-3 font-mono text-xs">
          {step.built ? (
            <>
              <span className="text-muted-foreground">Out</span>
              <span className="text-foreground tabular-nums">{formatWhole(step.built.rows)} rows</span>
              {step.built.modelVersion && <span className="text-muted-foreground">{step.built.modelVersion}</span>}
            </>
          ) : (
            <span className="text-muted-foreground">Nothing written</span>
          )}
          <span className="ml-auto flex items-center gap-3 font-sans">
            <Link href={`/data/tables/${encodeURIComponent(step.mart)}`} className="text-basecast-brand hover:underline">
              Table
            </Link>
            {screen && (
              <Link href={screen.href} className="inline-flex items-center gap-1 text-basecast-brand hover:underline">
                {screen.label}
                <ArrowRight className="size-3" aria-hidden />
              </Link>
            )}
          </span>
        </div>
      </div>
    </Cell>
  );
}

function LogCell({ n, runId }: { n: number; runId: string }) {
  const logs = useRunLogs(runId);
  const entries = logs.data?.entries ?? [];
  return (
    <Cell n={n} icon={ScrollText} title="Log" aside={logs.data ? `${entries.length} lines` : undefined}>
      {logs.isPending ? (
        <Skeleton className="h-24 w-full" />
      ) : logs.isError ? (
        <p className="text-xs text-muted-foreground">{logs.error.message}</p>
      ) : entries.length === 0 ? (
        <p className="text-xs text-muted-foreground">No log line for this run.</p>
      ) : (
        <div className="max-h-96 overflow-auto rounded-md border border-border bg-muted/30 p-2 font-mono text-[11px] leading-relaxed">
          {[...entries].reverse().map((e) => (
            <div key={e.id} className={cn("whitespace-pre-wrap", e.level === "error" ? "text-red-600 dark:text-red-400" : e.level === "warn" ? "text-amber-700 dark:text-amber-400" : "text-foreground")}>
              <span className="text-muted-foreground">{formatDateTime(e.ts).replace(/, \d{4}/, "")}</span> {e.event} {e.message}
            </div>
          ))}
        </div>
      )}
    </Cell>
  );
}

/**
 * /backtest/runs/[runId]: one model run (a mart build) read as an audited notebook, cell by cell in the order it
 * ran: the parameters, the config it fixed, one cell per mart (what it reads, its asserts with expected and
 * actual, what it wrote), what the build does not record yet, and the log.
 */
export function RunNotebook({ runId }: { runId: string }) {
  const query = useModelRun(runId);
  const short = shortRunId(runId);
  const breadcrumb = (
    <PageBreadcrumb
      items={[
        { label: "Backtest", href: "/backtest" },
        { label: "Models", href: "/backtest?tab=models" },
        { label: `Run ${short}` },
      ]}
    />
  );
  if (query.error && !query.data) throw query.error;
  if (query.run === undefined) {
    return (
      <div className="space-y-6">
        {breadcrumb}
        <Skeleton className="h-10 w-72" />
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }
  const run = query.run;
  if (!run) {
    return (
      <>
        {breadcrumb}
        <EmptyState Icon={SearchX} title="Run not found" />
      </>
    );
  }

  const steps = stepsOf(run);
  const t = tally(run.checks);
  let n = 0;
  return (
    <div className="space-y-6">
      {breadcrumb}
      <PageHeader
        title={<span className="font-mono">Run {short}</span>}
        actions={<AppBadge state={RUN_STATE[run.status] ?? "meta"}>{run.status}</AppBadge>}
      />
      <KpiStatCard>
        <KpiStatItem icon={Calendar} label="Started">
          {formatDateTime(run.startedAt)}
        </KpiStatItem>
        <KpiStatItem icon={Clock} label="Duration">
          {formatDuration(run.durationS)}
        </KpiStatItem>
        <KpiStatItem icon={GitCommitHorizontal} label="Code">
          <span className="font-mono">{run.code ?? GAP}</span>
        </KpiStatItem>
        <KpiStatItem icon={ListChecks} label="Checks">
          {t.total ? `${t.passed} of ${t.total} passed` : GAP}
        </KpiStatItem>
      </KpiStatCard>

      <ol className="space-y-4">
        <Cell n={++n} icon={Settings2} title="Parameters">
          <ParamsBlock run={run} />
        </Cell>
        <Cell
          n={++n}
          icon={Layers}
          title="Config"
          tone="muted"
          aside={<AppBadge state="metadata">Not recorded</AppBadge>}
        >
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span>
              <span className="font-mono text-foreground">config/marts.yaml</span> at{" "}
              <span className="font-mono text-foreground">{run.code ?? "unknown"}</span>
            </span>
            <InfoTip label="About the config">
              A build refuses uncommitted changes to the code and the config, so the commit fixes both. The resolved
              values are not stored with the run yet.
            </InfoTip>
          </p>
        </Cell>
        {steps.map((step) => (
          <MartCell key={step.mart} n={++n} step={step} />
        ))}
        {run.issues
          .filter((i) => !i.mart)
          .map((issue, i) => (
            <Cell key={`issue-${i}`} n={++n} icon={CircleX} title="Error" tone="failed">
              <p className="text-xs text-red-600 dark:text-red-400">{issue.text}</p>
            </Cell>
          ))}
        <Cell
          n={++n}
          icon={FlaskConical}
          title="Fit diagnostics"
          tone="muted"
          aside={<AppBadge state="metadata">Not recorded</AppBadge>}
        >
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            Coefficients, residuals, calibration and input freshness are computed during the build but not stored.
            <InfoTip label="What is missing">
              The organic fit (β, covariance, σ), the rolling-origin errors, the ratio and U tables per backtest date,
              the survival curves refit at each date, and each input table&apos;s date and row count. Earlier versions
              of the marts are replaced by each build.
            </InfoTip>
          </p>
        </Cell>
        <LogCell n={++n} runId={run.runId} />
      </ol>
      <p className="flex items-center gap-1.5 border-t border-border pt-3 text-xs text-muted-foreground">
        <Database className="size-3.5" aria-hidden />
        <span className="font-mono">etl_run {run.runId}</span>
        {run.finishedAt && <span>· finished {formatDateTime(run.finishedAt)}</span>}
        {run.rows != null && <span>· {formatWhole(run.rows)} rows written</span>}
      </p>
    </div>
  );
}
