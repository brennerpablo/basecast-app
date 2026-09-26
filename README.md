# basecast-app

Next.js frontend for **basecast**, which forecasts how much of ERCOT's interconnection queues (large
loads and generation) actually gets built, where and when, and turns that into peak-demand forecasts and
partnership decisions.

Pages: county map (Explorer), forecast, backtest, commercial intelligence for co-ops and munis, and
pipeline status. The browser only talks to this app's route handlers (BFF), which call
`basecast-get-data` with a server-side token.

> **Status:** bootstrap. The app base (layout, auth, components, theme) has not been copied in yet
> (task B0).

## Repos

| Repo | Role |
|---|---|
| `basecast-airflow` | Ingestion and models |
| `basecast-get-data` | FastAPI service; owns the data contract |
| `basecast-app` | Next.js frontend (this repo) |

## Setup

```bash
cp .env.example .env.local   # GET_DATA_URL, GET_DATA_TOKEN (server-only), ACCESS_MODE
```

`ACCESS_MODE=public` gives a read-only demo without login (for the judges); `ACCESS_MODE=login` uses the
app's auth.

## Docs

- `docs/KICKOFF.md`: project kickoff (Portuguese)
- `CLAUDE.md`: working context for Claude Code
