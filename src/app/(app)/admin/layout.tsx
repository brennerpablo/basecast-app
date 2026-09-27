import { requireSuperAdmin } from "@/lib/auth/session";

/** Every screen under /admin is for superadmins only: anyone else gets a 404. */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireSuperAdmin();
  return children;
}
