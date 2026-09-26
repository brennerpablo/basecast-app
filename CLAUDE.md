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
~232.5 GW of large loads, only 3.8% of them approved to energize, against a demand record of ~87–91 GW.
ERCOT's own official preliminary 2026 forecast (~112 GW) missed that same year's peak by more than 20 GW.

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
├── public/geo/               # Texas counties TopoJSON (generated in task A1)
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
- **Map:** MapLibre GL with the Texas counties (TopoJSON from task A1), choropleth by FIPS via
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

- `basecast-airflow` (front A): produces the data and the county TopoJSON for `public/geo/`.
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
- Tests: `npm test` (Node's `node:test` run by `tsx`, `jsdom` for DOM tests), next to the code as `*.test.ts(x)`.
- Some comments in `components/ui`, `components-app` and `fields` are still in Portuguese (pending
  translation pass).
- Login, required on every page: next-auth v4 in `src/lib/auth.ts`, session helpers
  (`getCachedSession`, `withSession` for BFF route handlers) in `src/lib/auth/session.ts`, the redirect/401
  gate in `src/proxy.ts` plus the check in `src/app/(app)/layout.tsx`, the page in `src/app/(auth)/sign-in/`.
  Users are in Cloud SQL (database `basecast`, schema `app`) through Prisma: `prisma/schema.prisma`,
  `src/lib/db.ts`, client generated to `src/generated/` on install. `npm run user:create` adds a user.
- User menu (`src/app/(app)/_components/user-menu.tsx`), the sidebar footer as in the Fundsys app: avatar
  with initials (`src/components/user-avatar.tsx`), then name and email, the theme submenu
  (`src/components/theme/theme-menu.tsx`) and sign out.
- Email: `sendEmail()` in `src/lib/email.ts` (server-only; Resend, from `noreply@basecast.pbrenner.com`). The
  check of Resend's `{ data, error }` lives in `src/lib/email/send.ts`, shared with `npm run email:test`.
  `RESEND_API_KEY` only sends from `basecast.pbrenner.com`.

## Same-window tabs

Ported from fundsys-app (section "Abas na mesma janela" of its `CLAUDE.md`). On desktop the card's first row is a
strip of app tabs; the breadcrumb moves below as the page title. Hidden on mobile.

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
