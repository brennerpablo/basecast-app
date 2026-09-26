# basecast-app

Next.js frontend for **BaseCast**, which forecasts how much of ERCOT's interconnection queues (large
loads and generation) actually gets built, where and when, and turns that into peak-demand forecasts and
partnership decisions.

Pages: county map (Explorer), forecast, backtest, commercial intelligence for co-ops and munis, and
pipeline status. The browser only talks to this app's route handlers (BFF), which call
`basecast-get-data` with a server-side token.

> **Status:** B0 done. The app shell (sidebar menu, page card, light and dark themes, component library)
> runs; every page is a placeholder until its data lands (B1–B3). No data access yet. Login
> (`ACCESS_MODE=login`) works; see [Access](#access).

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
| `npm run db:push` | Applies `prisma/schema.prisma` to the database (login mode) |
| `npm run user:create` | Creates a user (login mode); see [Access](#access) |

## Access

`ACCESS_MODE` picks one of two modes:

- `public` (the default, also when unset): read-only demo without login, so the judges get in without
  friction. Nothing touches the database.
- `login`: every page needs a session and API routes answer 401 without one. Users sign in with their
  email or username and a password (next-auth v4, Credentials provider, JWT sessions, as in the Fundsys
  app). Users live in Cloud SQL: database `basecast`, schema `app`.

Running `login` locally:

```bash
cloud-sql-proxy --port 5439 --quota-project basecast-509812 basecast-509812:us-central1:basecast-pg
# .env.local: ACCESS_MODE=login, DATABASE_URL, NEXTAUTH_SECRET (see .env.example)
npm run db:push   # creates or updates the tables in schema `app`
npm run dev
```

There is no sign-up screen: users are created from the command line. The script never overwrites an
existing username or email, and reads the password from stdin (a hidden prompt in a terminal):

```bash
npm run user:create -- --username jane --email jane@example.com --name "Jane Doe" [--superadmin]
```

The first superadmin is `pablo`; its password is in Secret Manager:

```bash
gcloud secrets versions access latest --secret app-superadmin-password --project basecast-509812
```

Not done yet: `login` on Vercel. Cloud SQL only accepts its own connectors, so the deployed app needs the
Cloud SQL Node connector and a service account. `public` needs no database, so the demo deploy does not
wait on this.

## Stack

Next.js 16 (App Router), React 19, Tailwind CSS 4, shadcn/Radix primitives, TanStack Query and Table,
Recharts, nuqs for URL state. The shell and components come from the Fundsys app base.

## Docs

- `docs/KICKOFF.md`: project kickoff (Portuguese)
- `docs/decisions.md`: decision log
- `CLAUDE.md`: working context for Claude Code
