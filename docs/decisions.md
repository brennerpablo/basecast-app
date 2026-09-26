# Decisions — basecast-app

One line per decision: date, decision, reason. Cross-repo decisions live in `basecast-get-data`.

- 2026-09-26 — B0 copies only the Fundsys shell (layout, sidebar, theme, `components/ui`, the generic part of `components-app`), picked by following imports from each entry file, instead of copying the whole repo and deleting. — The Fundsys `src/` has ~5.4k files and its shell is tied to session, RBAC, Prisma and domain modules; the import closure keeps only what the app uses.
- 2026-09-26 — No login for now: only `ACCESS_MODE=public` (read-only demo) exists; the shell reads no session. — Judges must get in without friction; `login` mode comes later only if needed.
- 2026-09-26 — Next.js 16.3.6 instead of the 16.3.2 pinned in Fundsys. — 16.3.2 has two critical RCE advisories (GHSA-p293-qw3h-jr36, GHSA-2xp9-vwfh-vxw4); 16.3.6 is a patch bump.
- 2026-09-26 — `next.config` without `cacheComponents` / `partialPrefetching`. — Simpler for a small app: those require Suspense or `connection()` around every dynamic read. Can be turned on later.
- 2026-09-26 — Left out of the shell: app tab strip, ⌘K palette, notifications, audit, org switcher, user menu; the `Tabs` component keeps only `urlParam` (tab in the URL). — All coupled to Fundsys modules; not needed for the demo.
- 2026-09-26 — Dropped from `components-app`: `DataMatrixTable`, the compliance status badge, tag catalog, sub-actions and the risk/reference-series fields. — Domain or regulatory logic from Fundsys.
- 2026-09-26 — Neutral names for what carried the Fundsys brand: `--basecast-brand-*` CSS palette, `BRAND` tokens, `AppBadge` / `AppColoredBadge`, `basecast-theme` cookie. Emerald colors stay until the visual pass (B4). — No Fundsys branding in code; colors change later.
- 2026-09-26 — UI text in English with en-US dates; the Portuguese comments still in `components/ui`, `components-app` and `fields` get translated in a separate pass. — Agreed with the user to keep B0 fast.
- 2026-09-26 — `/` redirects to `/explorer` in `next.config` (307), not from a page. — A redirect page streams a 200 and only leaves on the client.
