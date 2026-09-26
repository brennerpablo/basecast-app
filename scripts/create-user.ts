/**
 * Creates a user who can sign in. It never overwrites: an existing username or email fails.
 *
 *   npm run user:create -- --username jane --email jane@example.com [--name "Jane Doe"] [--superadmin]
 *
 * The password comes from stdin, so it stays out of shell history and `ps`: a hidden prompt in a
 * terminal, or a pipe, e.g. the first superadmin's from Secret Manager:
 *
 *   gcloud secrets versions access latest --secret app-superadmin-password --project basecast-509812 \
 *     | npm run user:create -- --username ... --email ... --superadmin
 *
 * Needs DATABASE_URL (read from .env) and the Cloud SQL proxy running.
 */
import { existsSync } from "node:fs";
import { loadEnvFile } from "node:process";
import { createInterface } from "node:readline/promises";
import { Writable } from "node:stream";
import { parseArgs } from "node:util";

import { PrismaPg } from "@prisma/adapter-pg";
import { hash } from "bcrypt";

import { PrismaClient } from "@/generated/prisma/client";
import {
  BCRYPT_COST,
  MIN_PASSWORD_LENGTH,
  normalizeIdentifier,
  USERNAME_PATTERN,
} from "@/lib/auth/credentials";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function readPassword(): Promise<string> {
  if (!process.stdin.isTTY) {
    const chunks: Buffer[] = [];
    for await (const chunk of process.stdin) chunks.push(chunk as Buffer);
    return Buffer.concat(chunks).toString("utf8").replace(/\r?\n$/, "");
  }
  // Typed characters echo to `output`; a sink that drops them hides the password.
  const hidden = new Writable({ write: (_chunk, _encoding, done) => done() });
  const rl = createInterface({ input: process.stdin, output: hidden, terminal: true });
  const ask = async (prompt: string) => {
    process.stdout.write(prompt);
    const answer = await rl.question("");
    process.stdout.write("\n");
    return answer;
  };
  const password = await ask("Password: ");
  const confirmation = await ask("Repeat password: ");
  rl.close();
  if (password !== confirmation) throw new Error("The passwords do not match.");
  return password;
}

async function main() {
  const { values } = parseArgs({
    options: {
      username: { type: "string" },
      email: { type: "string" },
      name: { type: "string" },
      superadmin: { type: "boolean", default: false },
    },
  });
  const username = normalizeIdentifier(values.username);
  const email = normalizeIdentifier(values.email);
  if (!USERNAME_PATTERN.test(username)) {
    throw new Error("--username: 3 to 32 of a-z, 0-9, '.', '_' or '-', starting with a letter or digit.");
  }
  if (!EMAIL_PATTERN.test(email)) throw new Error("--email: not an email address.");

  if (existsSync(".env.local")) loadEnvFile(".env.local");
  if (existsSync(".env")) loadEnvFile(".env");
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not set (see .env.example).");

  const password = await readPassword();
  if (password.length < MIN_PASSWORD_LENGTH) {
    throw new Error(`The password needs at least ${MIN_PASSWORD_LENGTH} characters.`);
  }

  const db = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
  });
  try {
    const taken = await db.user.findFirst({
      where: { OR: [{ username }, { email }] },
      select: { username: true, email: true },
    });
    if (taken) {
      const field = taken.username === username ? `username "${username}"` : `email "${email}"`;
      throw new Error(`A user with ${field} already exists; nothing was changed.`);
    }
    const user = await db.user.create({
      data: {
        username,
        email,
        name: values.name?.trim() || null,
        passwordHash: await hash(password, BCRYPT_COST),
        isSuperAdmin: values.superadmin,
      },
    });
    console.log(
      `Created ${user.isSuperAdmin ? "superadmin" : "user"} ${user.username} <${user.email}> (${user.id}).`,
    );
  } finally {
    await db.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
