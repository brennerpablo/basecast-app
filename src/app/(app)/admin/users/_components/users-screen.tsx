"use client";

import { Activity, UserPlus, UsersRound } from "lucide-react";
import { useMemo } from "react";

import { fmtDayTime } from "@/app/(app)/ops/_components/format";
import { GoogleIcon } from "@/app/(auth)/sign-in/_components/google-icon";
import { type ColumnMetadata, DataTable } from "@/components/components-app/data-table";
import { AppBadge } from "@/components/components-app/ui/badge";
import { DashboardStatCard } from "@/components/product/dashboard-stat-card";
import { formatWhole, GAP } from "@/components/product/format";
import { PageHeader } from "@/components/product/page-header";
import { UserAvatar } from "@/components/user-avatar";
import { type AdminUserRow, userStats } from "@/lib/admin/users";

const columns: ColumnMetadata<AdminUserRow>[] = [
  {
    columnId: "name",
    title: "User",
    type: "text",
    sortable: true,
    hideable: false,
    columnClassName: "min-w-56",
    filters: { text: true, textColumns: ["username", "email"] },
    cell: ({ row }) => {
      const { name, username, image } = row.original;
      return (
        <span className="flex items-center gap-2.5 py-0.5">
          <UserAvatar name={name || username} image={image} className="size-7" />
          <span className="flex min-w-0 flex-col gap-0.5">
            <span className="truncate leading-tight font-medium text-foreground">{name || username}</span>
            <span className="truncate text-xs text-muted-foreground">{username}</span>
          </span>
        </span>
      );
    },
  },
  {
    columnId: "email",
    title: "Email",
    type: "text",
    sortable: true,
    cell: ({ row }) => <span className="text-muted-foreground">{row.original.email}</span>,
  },
  {
    columnId: "method",
    title: "Sign-in",
    type: "text",
    sortable: true,
    filters: { checkbox: true },
    inferOptions: true,
    cell: ({ row }) => <AppBadge state="meta">{row.original.method}</AppBadge>,
  },
  {
    columnId: "role",
    title: "Role",
    type: "text",
    sortable: true,
    filters: { checkbox: true },
    inferOptions: true,
    cell: ({ row }) => (
      <AppBadge state={row.original.role === "Superadmin" ? "info" : "inactive"}>{row.original.role}</AppBadge>
    ),
  },
  {
    columnId: "createdAt",
    title: "Signed up",
    type: "text",
    sortable: true,
    columnClassName: "whitespace-nowrap",
    cell: ({ row }) => <span className="tabular-nums">{fmtDayTime(row.original.createdAt)}</span>,
  },
  {
    columnId: "lastLoginAt",
    title: "Last sign-in",
    type: "text",
    sortable: true,
    columnClassName: "whitespace-nowrap",
    cell: ({ row }) => (
      <span className="tabular-nums">{row.original.lastLoginAt ? fmtDayTime(row.original.lastLoginAt) : GAP}</span>
    ),
  },
];

/** /admin/users: everyone with an account, newest first. Read-only. Times in Chicago. */
export function UsersScreen({ rows }: { rows: AdminUserRow[] }) {
  const stats = useMemo(() => userStats(rows), [rows]);

  return (
    <div className="space-y-6">
      <PageHeader title="Users" />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <DashboardStatCard icon={<UsersRound className="size-5" />} title="Users" value={formatWhole(stats.total)} />
        <DashboardStatCard icon={<GoogleIcon />} title="With Google" value={formatWhole(stats.google)} />
        <DashboardStatCard
          icon={<UserPlus className="size-5" />}
          title="New, last 7 days"
          value={formatWhole(stats.newThisWeek)}
        />
        <DashboardStatCard
          icon={<Activity className="size-5" />}
          title="Active, last 7 days"
          value={formatWhole(stats.activeThisWeek)}
        />
      </div>

      <DataTable<AdminUserRow>
        columnsMetadata={columns}
        data={rows}
        tableName="admin-users"
        language="en"
        bordered
        compact
        enablePagination={false}
        enableDownload={false}
        toolbarIconsOnly
        getRowId={(row) => row.id}
      />
    </div>
  );
}
