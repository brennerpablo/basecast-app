import { existsSync } from "node:fs";
import { loadEnvFile } from "node:process";

import { defineConfig } from "prisma/config";

// Prisma's CLI does not read .env files on its own since v7.
if (existsSync(".env.local")) loadEnvFile(".env.local");
if (existsSync(".env")) loadEnvFile(".env");

export default defineConfig({
  // Unset in ACCESS_MODE=public, where nothing talks to the database; `prisma generate` does not need it.
  datasource: { url: process.env.DATABASE_URL ?? "" },
});
