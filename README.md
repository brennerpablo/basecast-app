# basecast-app

Next.js frontend for **BaseCast**, which forecasts how much of ERCOT's interconnection queues (large
loads and generation) actually gets built, where and when, and turns that into peak-demand forecasts and
partnership decisions.

Pages: county map (Explorer), forecast, backtest, commercial intelligence for co-ops and munis, and
pipeline status. The browser only talks to this app's route handlers (BFF), which call
`basecast-get-data` with a server-side token.

> **Status:** B0 done. The app shell (sidebar menu, page card, light and dark themes, component library)
> runs; every page is a placeholder until its data lands (B1–B3). No data access yet.

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
cp .env.example .env.local   # GET_DATA_URL, GET_DATA_TOKEN (server-only), ACCESS_MODE
npm run dev                  # http://localhost:3000
```

| Script | What it does |
|---|---|
| `npm run dev` | Dev server (Turbopack) |
| `npm run build` | Production build |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript, no emit |

## Access

`ACCESS_MODE=public` is a read-only demo without login, so the judges get in without friction. It is the
only mode implemented today; `ACCESS_MODE=login` is reserved for a later login flow.

## Stack

Next.js 16 (App Router), React 19, Tailwind CSS 4, shadcn/Radix primitives, TanStack Query and Table,
Recharts, nuqs for URL state. The shell and components come from the Fundsys app base.

## Docs

- `docs/KICKOFF.md`: project kickoff (Portuguese)
- `docs/decisions.md`: decision log
- `CLAUDE.md`: working context for Claude Code
