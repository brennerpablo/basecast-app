import "server-only";

import { compare } from "bcrypt";
import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";

import { DUMMY_PASSWORD_HASH, normalizeIdentifier } from "@/lib/auth/credentials";
import { db } from "@/lib/db";

/**
 * next-auth v4, as in the Fundsys app: Credentials only, JWT sessions, no adapter (Credentials never
 * uses the Account/Session tables). Only used in ACCESS_MODE=login.
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
        const user = await db.user.findUnique({
          where: identifier.includes("@") ? { email: identifier } : { username: identifier },
        });
        const valid = await compare(password, user?.passwordHash ?? DUMMY_PASSWORD_HASH);
        if (!user || !valid) return null;

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          username: user.username,
          isSuperAdmin: user.isSuperAdmin,
        };
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      // `user` is only there on sign-in; afterwards the token carries the fields.
      if (user) {
        token.username = user.username;
        token.isSuperAdmin = user.isSuperAdmin;
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
      await db.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
    },
  },
};
