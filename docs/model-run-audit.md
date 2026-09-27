# Model run audit: what the run page shows, and what it needs next

The run page (`/backtest/runs/[runId]`) reads one model run, a mart build, as an audited notebook. This note
records what it can show from today's data (layer A, built) and what `basecast-airflow` must record and
`basecast-get-data` must expose for the cells still marked "Not recorded" (layer B, proposed). Layer B changes
the contract, so it belongs in `basecast-get-data/docs/decisions.md` and `data-contract.md` once it is taken up.
It is kept here for now because a push to get-data's `main` redeploys the API during the hackathon.

## Layer A: shown now

Source: `etl_run` rows with `source = marts`, `stage = model`, read through get-data's
`/tables/etl_run/rows` (the generic table reader returns `events` and `params` as JSON text). The run's
`ops.log` lines come from the app's `/api/ops/logs?run=`.

| Cell | From |
|---|---|
| Parameters | `params`: `code` (git sha, clean tree enforced), `as_of`, `marts`, `dry_run` |
| Config | Only the commit: `config/marts.yaml` at `code`. Values not stored |
| One cell per mart | `mart.check` events (check, status, expected, actual, reason or error), `mart.built` (rows, `model_version`, duration), `error` and `mart.skipped`; the mart's description and inputs from `/tables/{name}` |
| Log | `ops.log` lines with the run's `run_id` |

## Layer B: proposed

### basecast-airflow records, per run

1. **Run id on the marts.** Write `etl_run.run_id` into `mart_meta` (and, for history, a `run_id` column on each
   mart). Today the link is inferred: a mart's `built_at` falls between the run's `started_at` and `finished_at`.
2. **Resolved config.** The `config/marts.yaml` switches (value and status) and the `account_score.yaml` weights,
   in `params.config`.
3. **Input freshness.** For each input table of each mart: max date and row count at build time, plus the deck
   manifests used (`params.inputs` or a `mart.input` event per table).
4. **Fit diagnostics (a model card per model).**
   - Peak: the organic fit (β, covariance, σ, n_train, training years), the rolling-origin errors and RMSE, the
     factor rows, the ratio table and U per variant and per backtest as-of, the zone split.
   - Queue: `StageCurve` counts (n, COD events) per stage and stratum, the curves refit at each backtest date, the
     Spearman n and p-value.
   - Seeds and draws (already in `mart_meta` for the peak forecast).
5. **History.** A lake artifact per run (`derived/model_runs/<run_id>/manifest.json` plus Parquet for the
   diagnostics), since marts and `mart_meta` are replaced by each build.
6. **A mart DAG (A-M7)**, so `dag_id`, `task_id` and `airflow_run_id` are filled.

### basecast-get-data exposes

1. `GET /pipeline/runs/{run_id}`: the row plus `events`, `params`, `airflow_run_id`, `try_number` and the marts
   written. The app then stops reading `etl_run` through the generic table reader.
2. `GET /models/runs/{run_id}/card`: the model card of item 4, one section per model.
3. `mart_meta` per mart as a resource (today only chosen keys surface inside product responses).
4. Mart lineage in `/tables/{name}/lineage` from the registry `inputs` (today it covers `lake_processed` only).
5. `data-contract.md` §6, the Pydantic schemas and `openapi.json` together; the app regenerates its client.

### The run page then

- Config cell: the resolved switches, with their review status.
- A new "Inputs" cell: each input table's date and rows, flagged when older than the run's `as_of` allows.
- "Fit diagnostics" becomes one cell per model card section: coefficients with standard errors, the residual
  plot, the rolling-origin error table, calibration of the P10–P90 band, the survival curves per backtest date.
- Runs compare: two runs side by side (checks and outputs that changed).
