import "server-only";

import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "@/generated/prisma/client";

declare global {
  var prisma: PrismaClient | undefined;
}

// The db-f1-micro instance allows 25 connections for Airflow, the API and the app together, so the
// pool stays small. The pool connects on the first query, never at import.
const createClient = () =>
  new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL, max: 5 }),
  });

// One client per process: dev hot reload would otherwise open a new pool on every edit.
export const db = globalThis.prisma ?? createClient();
if (process.env.NODE_ENV !== "production") globalThis.prisma = db;
