# basecast-app

Next.js frontend for **BaseCast**, which forecasts how much of ERCOT's interconnection queues (large
loads and generation) actually gets built, where and when, and turns that into peak-demand forecasts and
partnership decisions.

Pages: commercial intelligence for co-ops and munis (Accounts, the landing page), county map (Explorer),
forecast, backtest, and pipeline status. The browser only talks to this app's route handlers (BFF), which call
`basecast-get-data` with a server-side token.

> **Status:** B0 done. The app shell (sidebar menu, page card, light and dark themes, component library)
> runs; every page is a placeholder until its data lands (B1–B3). No data access yet. Login works;
> see [Access](#access).

## Repos

| Repo | Role |
|---|---|
| `basecast-airflow` | Ingestion and models |
| `basecast-get-data` | FastAPI service; owns the data contract |
| `basecast-app` | Next.js frontend (this repo) |

## Setup

Requires Node 22 or newer (`.nvmrc` pins 24, the version used on Vercel).

```bash
npm install
cp .env.example .env.local   # GET_DATA_URL, GET_DATA_TOKEN (server-only), DATABASE_URL, NEXTAUTH_SECRET
npm run dev                  # http://localhost:3000
```

The app needs a session on every page, so running it locally needs the database; see [Access](#access).

| Script | What it does |
|---|---|
| `npm run dev` | Dev server (Turbopack) |
| `npm run build` | Production build |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript, no emit |
| `npm run db:push` | Applies `prisma/schema.prisma` to the database |
| `npm run user:create` | Creates a user; see [Access](#access) |
| `npm run email:test` | Sends a test email; see [Email](#email) |
| `npm test` | Unit and DOM tests (`node:test` via `tsx`) |
| `npm run api:generate` | Regenerates `src/lib/api/get-data.d.ts` from `../basecast-get-data/openapi.json` |

## Access

Every page needs a session and API routes answer 401 without one. There are two ways in (next-auth v4, JWT
sessions, no adapter, as in the Fundsys app), and users live in Cloud SQL: database `basecast`, schema `app`.

- **Continue with Google**: anyone with a Google account signs up on first use (username from the email,
  Google's name and photo) and sees every screen except the admin ones. A verified Google email that
  matches a password user links to that user. Every superadmin gets an email on each sign-up. The button
  shows only where `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are set; Vercel preview URLs are not
  registered with Google, so previews sign in with a password.
- **Email or username and a password**, for users made from the command line (below).

Admin is `isSuperAdmin`, checked in the database: `requireSuperAdmin()` on an admin page (a 404 for
anyone else) and `withSuperAdmin()` on its BFF routes (403), both in `src/lib/auth/session.ts`.

Running it locally:

```bash
cloud-sql-proxy --port 5439 --quota-project basecast-509812 basecast-509812:us-central1:basecast-pg
# .env.local: DATABASE_URL, NEXTAUTH_SECRET (see .env.example)
npm run db:push   # creates or updates the tables in schemas `app` and `ops`
npm run dev
```

Users change their own display name and photo on `/account` (user menu → Account); photos are stored in
the same database (`app."UserAvatar"`).

Password users are created from the command line. The script never overwrites an
existing username or email, and reads the password from stdin (a hidden prompt in a terminal):

```bash
npm run user:create -- --username jane --email jane@example.com --name "Jane Doe" [--superadmin]
```

The superadmin is `admin`; its password is in Secret Manager:

```bash
gcloud secrets versions access latest --secret app-superadmin-password --project basecast-509812
```

## Ops

`/ops` shows what the app, get-data and the pipelines are doing: service health, requests per route
(counts, 4xx/5xx, p50/p95/p99), pipeline runs from `etl_run`, and one log stream with a trace per
request. All three services write the same row shape to `ops.log` (Postgres `basecast`, schema `ops`;
format in basecast-get-data `docs/data-contract.md` §7), and the page reads it straight from Postgres.

The app logs with `log.info(event, message, fields)` from `src/lib/observability`: one JSON line on
stdout and, from `info` up, a row in `ops.log` written after the response. Rows are written only on a
deploy (`VERCEL_ENV` is set) or with `OPS_LOG=1`: a local server reaches the production database through
the Cloud SQL proxy, so by default its log stays on stdout. Every BFF route behind
`withSession` gets its `http.request` line; unhandled server errors come from `onRequestError`.

After `npm run db:push` created the table, run the grants once as `postgres` (the pipelines append,
and the app reads `etl_run` through the reader role):

```bash
psql "postgresql://postgres@127.0.0.1:5439/basecast" -v ON_ERROR_STOP=1 -f prisma/ops-grants.sql
```

## Data

`/data` browses everything the pipelines fetched and built, through basecast-get-data (run it locally
with its README; `GET_DATA_URL` and `GET_DATA_TOKEN` point the app at it). Under `/data` the sidebar is
the Data mode's own: Overview, Tables, Pipeline runs, Flow and the bucket's folder tree.

- `/data`: every raw source with its files, snapshots, formats and the tables it feeds.
- `/data/lake/<bucket path>`: the route mirrors `gs://basecast-509812-lake`, so every folder and file has a
  link. A file opens with a viewer for its format (spreadsheets and CSVs in a positional grid, Parquet
  and JSON as typed grids, PDFs in pdf.js, zip members, slide and document text), its manifest entry and
  the tables it fed.
- `/data/tables` and `/data/tables/<name>`: the processed tables in Postgres and BigQuery, with rows in the
  DataGrid (server blocks of 500, sort and filters on the server), the schema and the raw files behind them.
- `/data/runs`: the pipelines' `etl_run` history.
- `/data/flow`: the dataset flow in React Flow, from each origin (publisher) through its ingest and process
  steps to the tables it writes and the derived tables built from them. Each node says when its data last
  updated, with a health icon: up to date, running, overdue (no update 6 h past the next scheduled run of
  `schedule_cron`, America/Chicago), degraded (last run abandoned or partial), failed, never. Selecting a node
  highlights its whole lineage and opens its details.

The browser only calls the BFF under `/api/data` (`src/app/api/data/`), which adds the token: a
catch-all that forwards an allowlist of get-data paths, `grid/` for the DataGrid's blocks, and `file` for
bytes (a signed GCS URL when get-data can sign one, otherwise streamed with `Range`).

The product screens read get-data's v2 envelope (`data` plus a `meta` with sources, data date, model version and
caveats) through the same catch-all: `src/lib/bff/` fetches it, and `src/components/product/` shows each card's
caveats, provenance and its loading, "being rebuilt" (a 503 `mart_not_built`) and empty states.

## Email

The app sends email through [Resend](https://resend.com), from `BaseCast <noreply@basecast.pbrenner.com>`.
Server code calls `sendEmail()` from `src/lib/email.ts` with the content (heading, paragraphs, key facts, one
button), and every email comes out in the same layout (`src/lib/email/layout.ts`, light-mode colors, logo
inline). It rejects with `EmailError` when Resend refuses the email. `RESEND_API_KEY` is a sending-only key
restricted to `basecast.pbrenner.com` (Secret Manager `app-resend-api-key`). No product email exists yet.
To send a sample notification and see the layout in a real inbox:

```bash
npm run email:test -- --to jane@example.com
```

## Deploy

Vercel (personal scope `brennerpablos-projects`, project `basecast-app`), production at
https://basecast.pbrenner.com, deployed from `main`. Functions run in `cle1` (Cleveland, the closest region
to Cloud SQL in `us-central1`; see `vercel.json`).

Cloud SQL only accepts its own connectors and Vercel has no proxy, so production sets
`CLOUD_SQL_INSTANCE` and the app opens the tunnel with Google's Node connector, as the service account
`app-vercel` (role `cloudsql.client` only; its JSON key is `GCP_SA_KEY`). `DATABASE_URL` then only supplies
the user, password and database. Production env: `DATABASE_URL`, `NEXTAUTH_SECRET`,
`CLOUD_SQL_INSTANCE`, `GCP_SA_KEY`, `RESEND_API_KEY`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`. `NEXTAUTH_URL` stays unset: on Vercel next-auth takes
the host from the request, so the custom domain and the `*.vercel.app` URLs both work.

## Stack

Next.js 16 (App Router), React 19, Tailwind CSS 4, shadcn/Radix primitives, TanStack Query and Table,
Recharts, nuqs for URL state. The shell and components come from the Fundsys app base.

## Docs

- `docs/KICKOFF.md`: project kickoff (Portuguese)
- `docs/decisions.md`: decision log
- `CLAUDE.md`: working context for Claude Code
