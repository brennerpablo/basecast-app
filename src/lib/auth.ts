import "server-only";

import { compare } from "bcrypt";
import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";

import { userImage } from "@/lib/account/profile";
import { DUMMY_PASSWORD_HASH, normalizeIdentifier } from "@/lib/auth/credentials";
import type { GoogleProfile } from "@/lib/auth/google";
import { resolveGoogleUser } from "@/lib/auth/google-user";
import { getDb } from "@/lib/db";
import { log } from "@/lib/observability";

/** "Continue with Google" is on where the OAuth client is set (production; locally when `.env.local` has it). */
export const googleSignInEnabled = Boolean(
  process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET,
);

/**
 * next-auth v4, as in the Fundsys app: JWT sessions and no adapter, so there are no Account/Session
 * tables. Two ways in: a password (users made with `npm run user:create`) and Google, where anyone
 * signs up. The `signIn` callback maps a Google account to our user (`resolveGoogleUser`).
 */
export const authOptions: NextAuthOptions = {
  secret: process.env.NEXTAUTH_SECRET,
  session: { strategy: "jwt" },
  // Errors (a refused Google account) come back to /sign-in as `?error=`, shown in a toast.
  pages: { signIn: "/sign-in", error: "/sign-in" },
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
        // A Google-only user has no password hash: the dummy compare keeps the timing, and fails.
        const valid = await compare(password, user?.passwordHash ?? DUMMY_PASSWORD_HASH);
        if (!user?.passwordHash || !valid) {
          // The identifier stays out of the log: it may be an email.
          log.warn("auth.sign_in_failed", "Sign-in rejected: unknown user or wrong password");
          return null;
        }

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          image: userImage(user.id, user.avatar, user.imageUrl),
          username: user.username,
          isSuperAdmin: user.isSuperAdmin,
        };
      },
    }),
    ...(googleSignInEnabled
      ? [
          GoogleProvider({
            clientId: process.env.GOOGLE_CLIENT_ID!,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
          }),
        ]
      : []),
  ],
  callbacks: {
    async signIn({ user, account, profile }) {
      if (account?.provider !== "google") return true;
      const resolved = await resolveGoogleUser(profile as GoogleProfile);
      if (!resolved) return false;
      // Without an adapter next-auth hands this same object on to the token (`defaultToken` and the
      // `jwt` callback, in next-auth/core/routes/callback.js), so our id, username and photo replace
      // Google's there, and the `signIn` event below sees our id too.
      Object.assign(user, resolved);
      return true;
    },
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
          select: { name: true, imageUrl: true, avatar: { select: { updatedAt: true } } },
        });
        if (fresh) {
          token.name = fresh.name;
          token.picture = userImage(token.sub, fresh.avatar, fresh.imageUrl);
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
      log.info("auth.sign_in", "Signed in", { userId: user.id });
      const db = await getDb();
      await db.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
    },
  },
};
