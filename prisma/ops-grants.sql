-- Grants around ops.log, run once as `postgres` on the `basecast` database after `npm run db:push`
-- created the `ops` schema and its table. Idempotent.
--
--   psql "postgresql://postgres@127.0.0.1:5439/basecast" -v ON_ERROR_STOP=1 -f prisma/ops-grants.sql
--
-- The app (as `postgres`) owns ops.log: it writes its own lines and reads everything for /ops.

-- The pipelines append their lines; they never read, update or delete them.
GRANT USAGE ON SCHEMA ops TO basecast_writer;
GRANT INSERT ON ops.log TO basecast_writer;
GRANT USAGE ON SEQUENCE ops.log_id_seq TO basecast_writer;

-- /ops also reads the pipelines' run table (public.etl_run, owned by basecast_writer). The reader role
-- already has SELECT on every table the writer creates in public (default privileges set in
-- basecast-airflow deploy/gcp/02-cloudsql.sh), so the app inherits that instead of a per-table grant.
GRANT basecast_reader TO postgres;

-- get-data will append through a role of its own that can only INSERT here: basecast_reader stays
-- SELECT-only. Added with the API's logging, when the API has code.
