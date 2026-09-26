import "server-only";

import { compare } from "bcrypt";
import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";

import { avatarUrl } from "@/lib/account/profile";
import { DUMMY_PASSWORD_HASH, normalizeIdentifier } from "@/lib/auth/credentials";
import { getDb } from "@/lib/db";

/**
 * next-auth v4, as in the Fundsys app: Credentials only, JWT sessions, no adapter (Credentials never
 * uses the Account/Session tables).
 */
export const authOptions: NextAuthOptions = {
  secret: process.env.NEXTAUTH_SECRET,
  session: { strategy: "jwt" },
  pages: { signIn: "/sign-in" },
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        identifier: { label: "Email or username", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const identifier = normalizeIdentifier(credentials?.identifier);
        const password = credentials?.password ?? "";
        if (!identifier || !password) return null;

        // Usernames cannot contain "@", so the identifier's shape says which column to look in.
        const db = await getDb();
        const user = await db.user.findUnique({
          where: identifier.includes("@") ? { email: identifier } : { username: identifier },
          include: { avatar: { select: { updatedAt: true } } },
        });
        const valid = await compare(password, user?.passwordHash ?? DUMMY_PASSWORD_HASH);
        if (!user || !valid) return null;

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          image: user.avatar ? avatarUrl(user.id, user.avatar.updatedAt) : null,
          username: user.username,
          isSuperAdmin: user.isSuperAdmin,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, trigger }) {
      // `user` is only there on sign-in (next-auth copies its name and image into the token);
      // afterwards the token carries the fields.
      if (user) {
        token.username = user.username;
        token.isSuperAdmin = user.isSuperAdmin;
      }
      // /account calls `update()` after an edit. The new name and photo come from the database,
      // never from what the browser sent.
      if (trigger === "update" && token.sub) {
        const db = await getDb();
        const fresh = await db.user.findUnique({
          where: { id: token.sub },
          select: { name: true, avatar: { select: { updatedAt: true } } },
        });
        if (fresh) {
          token.name = fresh.name;
          token.picture = fresh.avatar ? avatarUrl(token.sub, fresh.avatar.updatedAt) : null;
        }
      }
      return token;
    },
    session({ session, token }) {
      session.user.id = token.sub!;
      session.user.username = token.username;
      session.user.isSuperAdmin = token.isSuperAdmin;
      return session;
    },
  },
  events: {
    async signIn({ user }) {
      const db = await getDb();
      await db.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
    },
  },
};
