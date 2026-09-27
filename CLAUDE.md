# CLAUDE.md — basecast-app

**basecast** is being built for the Base Power × AITX Hackathon (Austin, Sep 25–27, 2026). This repo is
**front B: the frontend**, a Next.js app built on the Fundsys app base and deployed to Vercel.

This file carries the stable parts of `docs/KICKOFF.md` (in Portuguese): sections 1, 2 and 7, this repo's
part of section 3, the working rules from section 0 and the front B rules from section 5. The tasks and
their done criteria (B0–B4) stay only in `docs/KICKOFF.md` §5.

## Working agreements

- Code, comments, README and names in English. Talk to the user in Portuguese.
- Plan each piece of work and show the plan to the user; implement only after approval.
- Never use "Novi" in code, packages or branding: Novi Labs is a real Austin company, and
  "Novi for Energy" is only the pitch analogy.
- Anything not confirmed at the source stays marked "not verified".
- Log decisions in `docs/decisions.md`, one line each: date, decision, reason. Decisions that affect more
  than one repo go to `basecast-get-data`, which owns the contract.
- Work on `main` only, in all three repos: no feature branches, no worktrees. Small commits pushed straight
  to `main`. A push to `main` deploys to production (Vercel for this repo), so typecheck, lint, test and
  build pass before every push.

## Product context (KICKOFF §1)

Base Power is an Austin energy company. It installs batteries in homes (and keeps owning them), sells
retail power and runs the fleet as a virtual power plant. It makes money from three sources: homeowners,
the ERCOT wholesale market, and utilities (co-ops and munis that buy capacity).

**Problem:** Texas plans its grid around inflated interconnection queues. In Jan 2026 ERCOT was tracking
~232.5 GW of large loads, only 3.8% of them approved to energize, against a demand record of 85,508 MW
(2023-08-10) until 2026-07-22, when the peak reached 91.1 GW (preliminary). ERCOT's own preliminary long-term
forecast for 2026 (~112 GW) missed that same year's peak by about 21 GW.

**Product:** forecast how much of the queues (large loads and generation) actually gets built, where and
when; turn that into a **peak MW** forecast by region and year (P10/P50/P90); and translate it into
decisions for Base, mainly for the partnerships team: which co-ops to approach, when, and with what offer.

**Modules:**
1. **Explorer:** Texas map by county; raw vs. adjusted queue; priority acquisition zones.
2. **Forecast:** per-project survival in the generation queue; aggregate flow by stage for large loads;
   weather-normalized load time series; backtest.
3. **Commercial intelligence (core of the demo):** prioritized accounts, triggers, per-co-op diagnosis,
   rule-based next action. Read-only; CSV/webhook export.
4. **Private data adapters:** `FleetDataSource` (Base's fleet, simulated) and `UtilityDataSource`
   (large-load requests the co-op itself received). Public data gives a zone-level view; private data
   takes the diagnosis down to the territory.

**Judging:** 5-minute video + code. Completeness without crashes, technical depth, track fit (Open Grid
Data is the main track), non-obvious insight, usability, performance.

## Architecture decisions, closed (KICKOFF §2)

- **Three repos, same design as Fundsys:** `basecast-airflow` (ingestion and models), `basecast-get-data`
  (API) and `basecast-app` (frontend). No monorepo.
- **Now:** mining runs locally on the Mac mini (Apple Silicon). Later it moves to a personal GCP project
  in `us-central1` (the ERCOT API blocks access from outside the US) and a personal Vercel account.
- **Lake:** immutable raw `raw/source=<id>/dt=<snapshot date>/<original file>` plus typed Parquet
  `parquet/<dataset>/dt=<date>/part-*.parquet`. The local layout is identical to the GCS bucket's, so
  moving up is `gcloud storage rsync` plus a BigQuery load, with no code rewrite.
- **Warehouse (later):** BigQuery, tables partitioned by day. No Cloud SQL (there are no user writes).
  *Superseded:* Cloud SQL `basecast-pg` exists, and the app keeps its login users there (`docs/decisions.md`).
- **Pipelines (`basecast-airflow`):** each source is a pure Python module with
  `run(*, storage, http, since=None, until=None)` that runs on its own from the CLI. The Airflow DAGs
  (later, on a VM with Docker Compose and LocalExecutor) will be thin and only call these `run()`
  functions. Patterns inherited from Fundsys: a `full` / `incremental` DAG factory, `etl_run` (one row per
  run with status, duration and events), idempotency (reprocessing never duplicates).
- **API (`basecast-get-data`):** FastAPI, later on Cloud Run. Same service name as Fundsys's, but
  **one typed endpoint per resource** (no dispatch by `process`), Pydantic, and an OpenAPI spec that
  generates the app's TypeScript client. Small marts loaded in memory (Polars) so the sliders respond in
  milliseconds.
- **Frontend (`basecast-app`):** Next.js on Vercel, built on the Fundsys base. The browser only talks to
  the BFF (route handlers); the API token stays on the server. TanStack Query. MapLibre for the map.
- **Time:** store everything in UTC; keep the sources' local hour and DST flag (ERCOT repeats an hour in
  November and uses "hour ending"); crons and display in `America/Chicago`.
- **Out of the MVP:** ancillary service prices (the post-RTC+B series is under a year old), 60-day
  disclosures, outages, short-term price forecasting, multi-tenancy, user writes.

## Repo layout (KICKOFF §3)

```
basecast-app/
├── CLAUDE.md
├── README.md
├── .env.example              # GET_DATA_URL, GET_DATA_TOKEN (server-only), DATABASE_URL, NEXTAUTH_SECRET
├── src/ (or app/)            # Fundsys base: layout, auth, components-app, theme
├── lib/api/                  # TypeScript client generated from get-data's openapi.json
├── public/geo/               # Texas counties and weather zones GeoJSON (A-M2)
└── docs/
    ├── KICKOFF.md
    └── decisions.md
```

## Front B rules (KICKOFF §5)

- **From the Fundsys base, keep** the layout/shell, auth, `components-app`, theme, the TanStack Query
  setup and the BFF pattern in route handlers. **Remove** tenant scoping, RBAC, Prisma and domain modules,
  Fundsys branding and any reference to clients or regulatory logic. No Fundsys data. (Prisma came back
  for the login users only; see `docs/decisions.md`.)
- **Auth stays simple.** The base's login on every page; document it in the README. *Superseded:* the
  kickoff's `ACCESS_MODE=public` (a read-only demo without login) was removed (`docs/decisions.md`).
- **Data access:** the BFF calls `basecast-get-data` (running locally with fixtures) through the
  TypeScript client generated from its `openapi.json`. The token stays on the server, never
  `NEXT_PUBLIC_`. No mocks inside the app: the fixtures live in the API, so the app talks to the real
  contract from day one.
- **Pages:** `/explorer` (map), `/forecast`, `/backtest`, `/accounts` and `/accounts/[id]` (commercial
  intelligence), `/data` (sources, last update and `etl_run` history, to show the pipeline's robustness).
- **Map:** MapLibre GL with the Texas counties (GeoJSON from A-M2; *superseded:* the kickoff's TopoJSON, see
  `docs/decisions.md`), choropleth by FIPS via
  feature-state, tooltip, legend and metric toggle. A token-free basemap (e.g., OpenFreeMap) or polygons
  only.
- **Visual:** follow the Fundsys components and charts, with basecast's own identity.

## General rules (KICKOFF §7)

- Plan before coding; small, descriptive commits; never commit `data/` or `.env`.
- Tests use small fixtures trimmed from real files, especially for the parsers.
- Label as **simulated** everything that comes from the private-data adapters and from fixtures.
- Don't invent URLs, IDs or columns; confirm them at the source or mark them "not verified".
- Contract changed? Update `data-contract.md`, the Pydantic models and `openapi.json` together, and
  regenerate the client in the app.
- Out of scope for now: Airflow deployment, BigQuery load, models, Fleet API mock, commercial-module
  logic, real mart reads in the API.

## Sibling repos

All three live in `~/Documents/repos/basecast/`:

- `basecast-airflow` (front A): produces the data and the geo for `public/geo/` (`basecast export-geo`).
- `basecast-get-data` (front C): the API this app's BFF calls; owns `docs/data-contract.md`. Regenerate
  `lib/api/` whenever its `openapi.json` changes.
- `basecast-app` (this repo, front B).

Reference only: `~/Documents/repos/fundsys/fundsys-app` (the base) and `~/Documents/repos/components-app`
(the component library). The fundsys-app `CLAUDE.md` is ~230 KB: search it, don't read it whole.

## Code map

- `src/app/(app)/`: the shell (`layout.tsx`, `_components/` with sidebar, card, skeleton) and one folder per
  page. Pages are placeholders until their data lands.
- `src/lib/navigation.ts`: the sidebar menu (`MAIN_MENU`). Add a page there to put it in the menu.
- `src/components/ui/`: shadcn primitives. `src/components/components-app/`: charts, DataTable and product
  components from the Fundsys base. Prefer these before adding a package.
- `src/app/globals.css`: tokens for light and the two dark themes (Zinc, Deep), in Base Power's colors (the
  `--bpc-color-*` tokens on basepowercompany.com). `--brand` (`bg-brand`) is the lime FILL; the forest INK for
  text, links and tints is `--basecast-brand-*` (mirrored in `src/lib/brand-tokens.ts`).
- `docs/brand/`: the brand kit as delivered (logos, mark, favicon). `public/brand/` holds cleaned copies used
  by `src/components/brand/logo.tsx`: the kit's dark cut and a green recolor of its light cut (the kit's light
  cut is blue). The favicon is `src/app/icon.svg`.
- `src/lib/tabs/` (store, URL title, link rule) + `src/components/tabs/` (hooks, `TabScreen`, link menus) +
  `src/app/(app)/_components/tabs/` (the strip) + `src/instrumentation-client.ts`: same-window tabs (below).
- `/data` (the data browser): pages in `src/app/(app)/data/`, screens in `src/components/data-browser/` (overview,
  folder and file views, previews, tables, runs, the Data mode sidebar swapped in by
  `src/app/(app)/_components/sidebar-modes.tsx`). The BFF is `src/app/api/data/` over `src/lib/get-data/` (the only
  place that calls get-data, server-only). Types come from get-data's `openapi.json` (`npm run api:generate` →
  `src/lib/api/get-data.d.ts`). Lake routes mirror the bucket path (`lake-path.ts`).
- `/data/flow` (dataset lineage): `src/components/data-flow/`. `graph.ts` builds origin → ingest → process →
  tables → derived from `/lake/sources`, `/tables` and `/pipeline/runs` (pure, tested); `health.ts` is the
  freshness rule (latest run, then `schedule_cron` + 6 h grace; its own small cron reader); `layout.ts` is dagre;
  `flow-view.tsx` renders it with `@xyflow/react` (state in the URL: `node`, `group`, `steps`, `derived`).
  A table is derived when built by SQL or when it declares `inputs` (the marts, `mode = replace`), and links to its
  input tables once get-data sends `inputs` (with C-2). The marts are a source outside the lake (`marts`) whose
  runs are `stage = model`; outside the lake the step reads the newer of its `process` and `model` runs.
- Product screens (accounts, explorer, forecast, backtest) read get-data's v2 envelope `{data, meta}` through the same
  BFF catch-all (add each path to the allowlist in `src/lib/get-data/routes.ts`). Client side in `src/lib/bff/`:
  `fetchEnvelope`, `BffError` (its `mart` is set on a 503 `mart_not_built`), `useProductQuery` (other failures go to
  `error.tsx`), `useCaveatCatalog` (`GET /caveats`, a bare `{items}`, not an envelope). `Meta`, `Caveat` and `Fact`
  are the generated contract types. Shared UI in `src/components/product/`: `SectionCard` (title, caveats, body,
  `Provenance` below), `DataCard` (a `SectionCard` over one query: loading, "being rebuilt", empty), `InfoTip` (an ⓘ with
  the text in its tooltip; `SectionCard`/`DataCard` take it as `info`), `FactGrid`, `StatCard`, `FactValue` (a null is a gap, never a zero), `CaveatBadges`, `VerifiedBadge` (`compact`: the icon alone, for table rows),
  `SimulatedBadge`, formatters in `format.ts`. Caveat labels and texts come only from the API. The Fundsys dashboard
  pieces, for screens moving off `SectionCard`: `PageHeader` (a screen's title with no card around it, actions on the right),
  `DashboardCardHeader` + `CardOpenLink` (`DashboardChartCard`'s icon tile header), `KpiItem`, `DashboardStatCard`
  (a list's or dashboard's stat, `row` or `stacked`, a toggle with `onClick`), `KpiStatCard`/`KpiStatItem` (one
  entity's KPI strip), `QueryBody` (the states of `DataCard` without the card), and `SectionCard`'s `icon` (the Fundsys
  section header). `ChartTooltipCard` (`chart-tooltip.tsx`) is the hover card every recharts chart shares.
  `SegmentedControl` (and /ops's range toggle) marks the chosen option in the brand's lime fill (`bg-brand`), never
  in foreground black. A panel that opens on a click (the Explorer's county, the data flow's node) goes through
  `usePresence` + `PANEL_ENTER`/`PANEL_EXIT` (`src/components/motion/presence.ts`: a fade with a short slide, held
  through its exit, off under reduced motion); a side column that makes room animates `grid-template-columns`.
  Sheets and dialogs already animate.
- `/accounts` (`src/app/(app)/accounts/`), laid out as Fundsys's CRM list: the title with the rank toggle and Export CSV,
  one `DashboardStatCard` per next action (counted over the whole ranking; a click filters by that action, again
  clears it), then the ranked co-ops and munis in a DataTable (the account cell shows type · G&T under the name). The filters live in the URL
  (`src/lib/accounts/filters.ts`: repeated keys, `county` from the Explorer, `rank=within_type`), go to get-data as
  they are, and the Export CSV link carries the same params; the chips' choices come from the unfiltered list.
  Trigger, flag and next-action labels and texts come from `GET /glossary` (`useCodeLabels` in
  `src/lib/accounts/labels.ts`); a code the glossary lacks shows raw.
- `/accounts/[id]` (`src/app/(app)/accounts/[id]/`): one account's diagnosis from `GET /accounts/{id}` as Fundsys's
  entity page: the header (name, type · G&T · counties, tier/rank/action badges, caveats), the KPI strip (header facts
  in `KPI_FACT_KEYS`; the rest go to Profile, `splitHeaderFacts` in `src/lib/accounts/summary.ts`), then one tab per part
  (`?tab=`, a file each): Overview (the call in stat cards, the pitch, lead trigger and latest events), Why now (timeline,
  active strong events, context triggers, the paged history from `/events`), Score (stats, contributions as bars, gaps
  and coverage, the signals table), Territory (the account's counties on the Explorer's map, counties, facts grouped by
  `groupTerritoryFacts`, queue, data centers, zone), Wholesale & 4CP (X13 requests as bars, X3 + X15 rates as stat
  cards), EIA series (charts, early release lighter, then the table), Profile (registry facts, a muni's city, X10). The
  provenance shows once, at the foot. A 404 (unknown or held-back id) is "Account not found". Facts render through
  `FactGrid`/`FactValue`; `formatValue` knows get-data's units.
- `/explorer` (`src/app/(app)/explorer/`): the county map in MapLibre GL (`maplibre-gl`, pinned), polygons only, no basemap
  or token. `CountyMap` (`src/components/maps/county-map.tsx`, also the account's locator) loads `public/geo/*.geojson`, keys counties by `county_fips` (`promoteId`) and takes each
  county's fill and fade as `feature-state`; the worker is copied to `public/maplibre/` on install
  (`scripts/copy-workers.mjs`) and set with `setWorkerUrl`. One `GET /geo/counties` feeds the three layers
  (`layer=acquisition|queue|data-centers`, with `list`, `metric`, `horizon`, `stratum`, `naics`, all in the URL); P1
  `layer=zones` (`measure=`) reads `GET /geo/zones` and paints each county with its weather zone's value, the counties
  ERCOT names dashed, with a zone table (allocation range, machine-read); the
  colors and legends are pure in `src/lib/explorer/` (dataviz palette: channel hue × priority class, one-hue blue
  ramp, blue ↔ red for rank change). Laid out as a Fundsys dashboard: `PageHeader`, the layers as line tabs with icons
  (`<Tabs urlParam="layer">`; the map sits outside them, so a switch repaints without a reload), the layer's filters
  in one labeled row, its stat cards (sums of the county rows, `src/lib/explorer/summary.ts`: the queue's add up to the
  statewide totals, counties flagged outside ERCOT included; the channel lists double as the `list` filter), the map
  card, the layer's own card (queue: its backtest; zones: the weather-zone table) and "Counties, ranked" (the map as a
  DataTable, `rankedCounties`; a county's name links to `county=`). `county=<fips>` opens the county panel beside them,
  sticky (`GET /geo/counties/{fips}`): KPI items, then sections with icon headers.
- `/forecast` (`src/app/(app)/forecast/`): `<Tabs urlParam="tab">` with `peak` (the summer peak in three stacked
  layers at P50 with the total's band as whiskers, labeled by `band_kind`; ERCOT's official lines in ink told apart by
  dash; variant and region in the URL; the numbers again as a table; the large-load inputs) and `large-loads`
  (promised × approved by deck, the ratio band with the API's definition, the monthly stock against the observed
  peak with the dated annotations), then the P1 tabs `queue` (survival curves cut where the API nulls them),
  `normalized` (actual × normal-weather load, summer peak against the normal band) and `4cp` (intervals against the
  window, dispatch curve, peak-hour shift, rates); a mart not built shows "being rebuilt". Chart colors and ink:
  `src/lib/charts/palette.ts` (dataviz slots, light and dark steps).
- `/backtest` (`src/app/(app)/backtest/`): a scorecard above the tabs (`scorecard.tsx`: peak MAPE against LTLF and CDR, wins
  against ERCOT era by era, bias, band coverage against its 80% target, the queue's rank ρ; orange where the model falls
  short), then the 2026 fan (every official vintage at its publication date, ERCOT's range,
  the actual, our P50 and band at the 8 backtest dates), a slider over the API's `as_of_dates` (an invalid `as_of`
  falls back to the latest), the cells of one date with each row's leak note, scores by era with the ablation
  (including the era ERCOT did better), the official vintages' error matrix, the generation-queue backtest and a Models tab
  (`models-card.tsx`: every model and benchmark with variant, dates, cells, MAPE, bias and leaks, read one backtest date
  at a time; a flag when the forecast's default variant is not the backtested one; the `stage = model` builds). Pure
  helpers in `backtest-data.ts` (tested); marks drawn on recharts' scales for hover targets and keyboard focus.
- `/backtest/runs/[runId]`: one model run (a mart build) as an audited notebook: numbered cells for the parameters, the
  config (only the commit for now), one cell per mart (inputs from `/tables/{name}`, the `mart.check` events as asserts
  with expected, actual and Δ, what `mart.built` wrote, links to the table and the screen), what is not recorded yet,
  and the run's `ops.log`. Runs come from `etl_run` through get-data's `/tables/etl_run/rows` (`src/lib/model-runs.ts`,
  pure and tested; hooks in `model-runs-query.ts`). The Models tab's "Model builds" rows open it. What airflow and
  get-data must add for the rest: `docs/model-run-audit.md`.
- `/insights` (`src/app/(app)/insights/`): the cards of `GET /insights` in the Fundsys dashboard look: `PageHeader` with
  the response's caveats, then two line tabs with icons (`?tab=`): "Headline" (grade A, brand accent) and
  "Supporting", one full-width `InsightCard` per finding stacked in each, the provenance at the foot. Each card: the icon tile header (icon by queue, else by
  the screen behind it), value and caption beside the figures (`KpiItem`), the line's required caveat as an amber "Caveat"
  badge (the text in its tooltip), the caveat badges the header doesn't already show, "Re-derived" when `verified`, and the
  open link to the screen behind it. First in
  the menu and the landing page (`/`, after sign-in, "Exit Data"); cards keep the API's order.
- `public/geo/`: `tx-counties.geojson` (254 counties; `county_fips` for `promoteId`, `county_name`, `weather_zone`,
  `in_ercot`) and `ercot-weather-zones.geojson` (`weather_zone`), from basecast-airflow `basecast export-geo`.
- `src/components/data-grid/` is the DataGrid (virtualized, server blocks through `src/lib/hooks/use-grid-window-query.ts`
  and `src/lib/grid-params.ts`); prefer it over DataTable for anything past a few thousand rows.
- Tests: `npm test` (Node's `node:test` run by `tsx`, `jsdom` for DOM tests), next to the code as `*.test.ts(x)`.
- Some comments in `components/ui`, `components-app` and `fields` are still in Portuguese (pending
  translation pass).
- Login, required on every page: next-auth v4 in `src/lib/auth.ts` (password, and "Continue with Google" where
  anyone signs up: `src/lib/auth/google.ts` pure rules, `google-user.ts` the upsert and the superadmins' email),
  session helpers (`getCachedSession`, `withSession` for BFF route handlers, `requireSuperAdmin` /
  `withSuperAdmin` for admin screens: admin is `isSuperAdmin`, everyone else sees the rest) in `src/lib/auth/session.ts`, the redirect/401
  gate in `src/proxy.ts` plus the check in `src/app/(app)/layout.tsx`, the page in `src/app/(auth)/sign-in/`.
  Users are in Cloud SQL (database `basecast`, schema `app`) through Prisma: `prisma/schema.prisma`,
  `src/lib/db.ts`, client generated to `src/generated/` on install. `npm run user:create` adds a user.
- User menu (`src/app/(app)/_components/user-menu.tsx`), the sidebar footer as in the Fundsys app: the photo,
  or the initials (`src/components/user-avatar.tsx`), then name and email, Account, the theme submenu
  (`src/components/theme/theme-menu.tsx`) and sign out. It reads `useSession()` (`AuthSessionProvider`, seeded
  in `(app)/layout.tsx`).
- Account (`/account`, `src/app/(app)/account/`): display name and photo. Routes `PATCH /api/account`,
  `PUT`/`DELETE /api/account/avatar`, `GET /api/users/[id]/avatar`; rules in `src/lib/account/profile.ts`;
  photos in `app."UserAvatar"`; crop dialog in `src/components/avatar-upload/`. After an edit the page calls
  `update()`, and the `jwt` callback re-reads name and photo from the database. `withSession` hands the
  session to the handler. Screens outside the sidebar get their tab name and icon from `OTHER_ROUTES`.
- Admin (`/admin/*`, `src/app/(app)/admin/`): superadmins only. `admin/layout.tsx` calls `requireSuperAdmin()` (a 404 for
  anyone else) and each page checks again before reading; the user menu shows them, first and in Fundsys's superadmin
  orange, only to superadmins (`ADMIN_USERS_ROUTE` in `OTHER_ROUTES`). `/admin/users`: every account, newest first
  (Prisma straight from the page; rows and stat cards pure in `src/lib/admin/users.ts`), read-only.
- Ops (`/ops`, `src/app/(app)/ops/`, after Data in the menu): tabs Overview, Requests, Pipelines, Logs, all state
  in the URL, refetch every 30 s. Reads `ops.log` and `public.etl_run` straight from Postgres
  (`src/lib/ops/queries.ts`, raw SQL) through `/api/ops/*`. The log is Prisma model `OpsLog` (schema `ops`),
  grants in `prisma/ops-grants.sql`, row format in basecast-get-data `docs/data-contract.md` §7. The app writes it
  with `log.info|warn|error(event, message, fields)` (`src/lib/observability/`, ported from Fundsys): stdout
  plus a row queued in `after()`, only on a deploy (`VERCEL_ENV`) or with `OPS_LOG=1` (a local server shares the
  production database through the proxy); `withSession` wraps every BFF request in `runWithRequestLog` (one
  `http.request` line, `x-request-id` echoed; healthy `/api/ops` polls are not stored); `src/instrumentation.ts`
  logs `server.error`. `getRequestId()` is the id to send to get-data as `x-request-id`.
- Email: `sendEmail()` in `src/lib/email.ts` (server-only; Resend, from `noreply@basecast.pbrenner.com`) takes
  content, not HTML: every email renders in the one layout of `src/lib/email/layout.ts` (forest band with the
  logo as an inline CID PNG from `logo.ts`, lime rule, light-mode tokens as hex; content is escaped). The
  check of Resend's `{ data, error }` lives in `src/lib/email/send.ts`. `npm run email:test` sends a sample
  notification. `RESEND_API_KEY` only sends from `basecast.pbrenner.com`.

## Screen text

Excess prose is what makes a dashboard look generated. A screen shows data; words only where the data needs them.

- No subtitle that restates the title, the legend, the filters or the tabs, or explains how to read or click. A
  subtitle holds data only (a date, a count, a unit). A definition or a card's own caveat goes in `info` (`InfoTip`).
- Titles are labels ("Peak hour"), not headlines ("The peak hour moved") or questions.
- Provenance once per screen, at its foot (one line, "As of {date}", the rest in its tooltip); caveats once per
  response, where the screen first shows it. Long API prose (captions, notes, definitions) goes to a tooltip or badge.
- No internal names in the UI: marts, tables, adapter classes, doc paths, X-refs.
- Empty states are a title; a description only when it adds something the title and buttons don't.

## Same-window tabs

Ported from fundsys-app (section "Abas na mesma janela" of its `CLAUDE.md`). On desktop the card's first row is a
strip of app tabs; the breadcrumb moves below as the page title, shown only for a trail (2+ items): a lone item repeats the screen's `PageHeader`. Hidden on mobile.

- **A tab is a URL, and the URL belongs to the active tab.** Switching tabs is `router.push`; every URL change
  (link, `nuqs`, `router.push`) is written to the active tab. No screen needs to know the strip exists.
- **Every screen lives in a tab: what it needs back lives in the URL or in `useTabState`.** `TabScreen` remounts
  the page on each tab switch (a `key` per tab; `cacheComponents` is off), so plain `useState` never leaks
  between two tabs on the same path, but it is also lost on a switch. `DataTable` filters, sorting and columns
  already use `useTabState`. Values must fit in JSON (`Date` is fine): pinned tabs store them in `localStorage`.
- **Navigation is a link (`Link`, `Button asChild` + `Link`), never `onClick={() => router.push()}`.** Every
  `<a href>` in the shell gets the right-click menu ("Open in new tab", "Copy link") from `GlobalLinkMenu`;
  `linkTarget` decides who is out (other origin, `target`, `download`, `/api`, `[role=menu]`,
  `[data-native-menu]`). Don't wrap links in `LinkMenu`; it is for non-anchor triggers.
- **Screen tabs bound to the URL are destinations**: `<Tabs urlParam="tab">` or `<Tabs tabHref={(v) => route}>`.
  `src/lib/tabs/screen-tabs.test.ts` fails a `<Tabs value={x}>` fed by `useQueryState`, or a
  `<Tabs defaultValue>` in a page file, without one of them.
- **A pinned tab never leaves its screen**: a push to another path opens a new tab after the pinned ones
  (`divertFromPinned`, from `onRouterTransitionStart`); `replace` (a `redirect()`) is left alone.
- **Tab name**: a pinned tab's given name, else the last `<PageBreadcrumb>` item, else the `MAIN_MENU` label.
  The browser title is `"<tab> · BaseCast"`.
- **Traps paid in fundsys/ops**: nothing in `history.state` (nuqs would drop queued URL writes); Back comes
  from `onRouterTransitionStart(url, "traverse")`, never `popstate`; a `<head>` observer keeps our `<title>`.
- **Storage**: `sessionStorage` `basecast.tabs.<owner>`, pinned tabs also in `localStorage`
  `basecast.pinned-tabs.<owner>`. `(app)/layout.tsx` passes the owner: the user id. Sign-out (`UserMenu`) calls `clearTabs()`; pinned tabs stay under the user's key.

## Docs

- `docs/KICKOFF.md`: the full kickoff, including tasks B0–B4 and the open questions (§8).
- `docs/decisions.md`: decision log.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
