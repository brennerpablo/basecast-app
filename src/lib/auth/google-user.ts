import "server-only";

import { after } from "next/server";
import type { User } from "next-auth";

import { userImage } from "@/lib/account/profile";
import { normalizeIdentifier } from "@/lib/auth/credentials";
import {
  type GoogleProfile,
  pickUsername,
  planGoogleSignIn,
  usernameFromEmail,
} from "@/lib/auth/google";
import { getDb } from "@/lib/db";
import { APP_URL, sendEmail } from "@/lib/email";
import { log } from "@/lib/observability";

const USER_SELECT = {
  id: true,
  username: true,
  email: true,
  name: true,
  imageUrl: true,
  isSuperAdmin: true,
  avatar: { select: { updatedAt: true } },
} as const;

/**
 * The BaseCast user behind a Google sign-in: found by Google id, linked by verified email, or created
 * (never a superadmin). Null refuses the sign-in (next-auth answers `AccessDenied`).
 */
export async function resolveGoogleUser(profile: GoogleProfile): Promise<User | null> {
  const db = await getDb();
  const email = normalizeIdentifier(profile.email);
  const [byGoogleId, byEmail] = await Promise.all([
    db.user.findUnique({ where: { googleId: profile.sub }, select: { id: true, googleId: true } }),
    email ? db.user.findUnique({ where: { email }, select: { id: true, googleId: true } }) : null,
  ]);
  const plan = planGoogleSignIn(profile, byGoogleId, byEmail);
  const imageUrl = profile.picture ?? null;

  let user;
  switch (plan.kind) {
    case "reject":
      log.warn("auth.google_rejected", "Google sign-in refused", { context: { reason: plan.reason } });
      return null;
    case "existing":
      user = await db.user.update({ where: { id: plan.userId }, data: { imageUrl }, select: USER_SELECT });
      break;
    case "link":
      user = await db.user.update({
        where: { id: plan.userId },
        data: { googleId: profile.sub, imageUrl },
        select: USER_SELECT,
      });
      log.info("auth.google_linked", "Google account linked to an existing user", { userId: user.id });
      break;
    case "create": {
      const created = await createGoogleUser(profile.sub, email, profile.name?.trim() || null, imageUrl);
      log.info("auth.sign_up", "Signed up with Google", { userId: created.id });
      after(() => notifySuperAdmins(created));
      user = created;
      break;
    }
  }

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    image: userImage(user.id, user.avatar, user.imageUrl),
    username: user.username,
    isSuperAdmin: user.isSuperAdmin,
  };
}

async function createGoogleUser(googleId: string, email: string, name: string | null, imageUrl: string | null) {
  const db = await getDb();
  const base = usernameFromEmail(email);
  // Two sign-ups can pick the same free username at once; the loser's insert fails on the unique
  // index and it picks again.
  for (let attempt = 0; ; attempt++) {
    const taken = await db.user.findMany({
      where: { username: { startsWith: base.slice(0, 28) } },
      select: { username: true },
    });
    const username = pickUsername(base, new Set(taken.map((row) => row.username)));
    try {
      return await db.user.create({
        data: { username, email, name, googleId, imageUrl },
        select: USER_SELECT,
      });
    } catch (error) {
      const code = (error as { code?: string }).code;
      if (code !== "P2002" || attempt >= 2) throw error;
    }
  }
}

/** Every superadmin hears about a new sign-up, so the demo's visitors are known. Failures only log. */
async function notifySuperAdmins(user: { username: string; email: string; name: string | null }) {
  try {
    const db = await getDb();
    const admins = await db.user.findMany({ where: { isSuperAdmin: true }, select: { email: true } });
    if (admins.length === 0) return;
    await sendEmail({
      to: admins.map((admin) => admin.email),
      subject: `New sign-up: ${user.name ?? user.email}`,
      preheader: `${user.email} signed up with Google.`,
      eyebrow: "New sign-up",
      heading: `${user.name ?? user.email} signed up`,
      paragraphs: ["A new user signed up with Google. They can see every screen except the admin ones."],
      details: [
        { label: "Name", value: user.name ?? "—" },
        { label: "Email", value: user.email },
        { label: "Username", value: user.username },
      ],
      action: { label: "Open BaseCast", url: APP_URL },
      footnote: "You get this email because you are a BaseCast superadmin.",
    });
  } catch (error) {
    log.error("auth.sign_up_notify_failed", "Could not email the superadmins about a sign-up", { error });
  }
}
