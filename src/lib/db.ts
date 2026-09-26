import "server-only";

import { Connector, IpAddressTypes } from "@google-cloud/cloud-sql-connector";
import { PrismaPg } from "@prisma/adapter-pg";
import { GoogleAuth } from "google-auth-library";
import { Pool } from "pg";

import { PrismaClient } from "@/generated/prisma/client";

declare global {
  var prisma: Promise<PrismaClient> | undefined;
}

// The db-f1-micro instance allows 25 connections for Airflow, the API and the app together, so the
// pool stays small.
const POOL_MAX = 5;

/**
 * Locally, DATABASE_URL points at `cloud-sql-proxy`. On Vercel there is no proxy and the instance only
 * accepts Google's connectors, so CLOUD_SQL_INSTANCE turns on the Node connector: it opens the TLS
 * tunnel itself, authenticated as the service account in GCP_SA_KEY (JSON key, role
 * `cloudsql.client` only). DATABASE_URL then only supplies the user, password and database.
 */
async function createPool(): Promise<Pool> {
  const connectionString = process.env.DATABASE_URL;
  const instanceConnectionName = process.env.CLOUD_SQL_INSTANCE;
  if (!instanceConnectionName) return new Pool({ connectionString, max: POOL_MAX });

  const connector = new Connector({
    auth: new GoogleAuth({
      credentials: JSON.parse(process.env.GCP_SA_KEY ?? "{}"),
      scopes: ["https://www.googleapis.com/auth/sqlservice.admin"],
    }),
  });
  const { stream } = await connector.getOptions({
    instanceConnectionName,
    ipType: IpAddressTypes.PUBLIC,
  });
  return new Pool({ connectionString, stream, max: POOL_MAX });
}

/**
 * The Prisma client, created on first use (never at import, so ACCESS_MODE=public never connects).
 * One per process: dev hot reload would otherwise open a new pool on every edit. A failed start is
 * not cached, so the next request tries again.
 */
export function getDb(): Promise<PrismaClient> {
  globalThis.prisma ??= createPool()
    .then((pool) => new PrismaClient({ adapter: new PrismaPg(pool) }))
    .catch((error: unknown) => {
      globalThis.prisma = undefined;
      throw error;
    });
  return globalThis.prisma;
}
