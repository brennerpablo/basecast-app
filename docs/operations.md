# Operations

The detail behind the README: access, the data snapshot, the `/data` browser, logging and deploy.

## Access

The app is a public demo: no sign-in, no users, no database. `/` is the product landing page and
`/how-its-built` the engineering one (static files in `public/landing/`); their "Open the demo" button leads
to `/home`. The retired signed-in screens (`/sign-in`, `/account`, `/admin`, `/ops`) redirect to `/home`
(`src/lib/gate.ts`, applied by `src/proxy.ts`).

A banner above every screen says what this copy is: built for the Base Power × AITX Hackathon, running on a
snapshot recorded on one day (`src/components/demo/`, facts in `src/lib/demo.ts`, the date from
`snapshot/manifest.json`). Closing it sets the `demo_banner` cookie; the sidebar's footer card keeps the same
facts, the link to `/how-its-built` and the theme.

## The snapshot

After the hackathon the pipelines (basecast-airflow), the API (basecast-get-data), Cloud SQL and the lake's
bucket were shut down to bring the GCP bill to zero. The app answers from `snapshot/`: get-data's responses,
recorded once from the live API on 2026-09-29 and committed (5.3 MB, gzipped JSON).

- `scripts/snapshot/record.ts` (`npm run snapshot:record`) crawled every resource the screens read with every
  parameter they can send, taking the choices (variants, regions, backtest dates, horizons and strata,
  counties, accounts, tables, lake folders) from the answers themselves, plus the model runs' `ops.log` lines
  from Postgres. It needs the live services, so it can no longer run; it stays as the record of how the
  snapshot was made. The layout is `src/lib/snapshot/paths.ts`.
- `src/lib/snapshot/resolve.ts` answers a get-data path from it with the API's envelope and statuses. Where
  a screen sends open-ended parameters, the routers' filters are ported: the accounts list and its CSV,
  an account's events, pipeline runs, table rows (`filter`, `sort`, paging) and the lake's listings. Its
  tests check them against filtered answers the live API gave (`parity`).
- What is not in it: the lake's files (a file page shows its details, provenance and lineage, no preview or
  download), and past the first 500 rows of each table (`etl_run` is whole; filters and sorting work within
  what was kept).

## Data

`/data` browses everything the pipelines fetched and built. Under `/data` the sidebar is the Data mode's own:
Overview, Tables, Pipeline runs, Flow and the bucket's folder tree.

- `/data`: every raw source with its files, snapshots, formats and the tables it feeds.
- `/data/lake/<bucket path>`: the route mirrors `gs://basecast-509812-lake`, so every folder and file has a
  link. A file shows its manifest entry, where it came from and the tables it fed.
- `/data/tables` and `/data/tables/<name>`: the processed tables that lived in Postgres and BigQuery, with
  their first rows in the DataGrid, the schema and the raw files behind them.
- `/data/runs`: the pipelines' `etl_run` history.
- `/data/flow`: the dataset flow in React Flow, from each origin (publisher) through its ingest and process
  steps to the tables it writes and the derived tables built from them. Each node says when its data last
  updated, with a health icon: up to date, running, overdue (no update 6 h past the next scheduled run of
  `schedule_cron`, America/Chicago), degraded (last run abandoned or partial), failed, never. With the
  pipelines stopped, "now" is the snapshot's recording time (`useSnapshotNow`), so the health reads as it did
  that day. Selecting a node highlights its whole lineage and opens its details.

The browser only calls the BFF under `/api/data` (`src/app/api/data/`): a catch-all over the snapshot and
`grid/` for the DataGrid's blocks. The answers carry `Cache-Control: public, max-age=3600, s-maxage=86400`:
the snapshot only changes with a deploy, so Vercel's CDN serves most of them.

The product screens read get-data's v2 envelope (`data` plus a `meta` with sources, data date, model version and
caveats) through the same catch-all: `src/lib/bff/` fetches it, and `src/components/product/` shows each card's
caveats, provenance and its loading, "being rebuilt" and empty states.

## Logging

The app logs with `log.info(event, message, fields)` from `src/lib/observability`: one JSON line on stdout,
Vercel's runtime log. Every data route gets its `http.request` line (`withRequestLog`); unhandled server
errors come from `onRequestError`. The `ops.log` table and the `/ops` screen that read it left with Cloud SQL.

## Deploy

Vercel (personal scope `brennerpablos-projects`, project `basecast-app`), production at
https://basecast.pbrenner.com, deployed from `main`. The app needs no environment variables. Functions run in
`cle1` (`vercel.json`), chosen when they called Cloud SQL in `us-central1`.
