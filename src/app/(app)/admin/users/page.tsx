import { PageBreadcrumb } from "@/components/page-breadcrumb";
import { userImage } from "@/lib/account/profile";
import { type AdminUserRow, signInMethod } from "@/lib/admin/users";
import { requireSuperAdmin } from "@/lib/auth/session";
import { getDb } from "@/lib/db";

import { UsersScreen } from "./_components/users-screen";

/** Who has an account, newest first: the Google sign-ups of the demo and the password users. */
export default async function AdminUsersPage() {
  // The layout already checked; a page renders in parallel with its layout, so it checks again before reading.
  await requireSuperAdmin();
  const db = await getDb();
  const users = await db.user.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      username: true,
      email: true,
      imageUrl: true,
      passwordHash: true,
      googleId: true,
      isSuperAdmin: true,
      createdAt: true,
      lastLoginAt: true,
      avatar: { select: { updatedAt: true } },
    },
  });
  const rows: AdminUserRow[] = users.map((user) => ({
    id: user.id,
    name: user.name,
    username: user.username,
    email: user.email,
    image: userImage(user.id, user.avatar, user.imageUrl),
    method: signInMethod(user.passwordHash !== null, user.googleId !== null),
    role: user.isSuperAdmin ? "Superadmin" : "User",
    createdAt: user.createdAt.toISOString(),
    lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
  }));

  return (
    <>
      <PageBreadcrumb items={[{ label: "Users" }]} />
      <UsersScreen rows={rows} />
    </>
  );
}
