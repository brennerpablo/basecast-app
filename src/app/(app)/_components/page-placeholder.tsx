import type { LucideIcon } from "lucide-react";

import EmptyState from "@/components/empty-state";
import { type BreadcrumbEntry, PageBreadcrumb } from "@/components/page-breadcrumb";

/**
 * Stand-in body for a page whose content has not been built yet. Declares the
 * breadcrumb like a real page, so the shell looks the same.
 */
export function PagePlaceholder({
  breadcrumb,
  Icon,
  title,
  description,
}: {
  breadcrumb: BreadcrumbEntry[];
  Icon: LucideIcon;
  title: string;
  description: string;
}) {
  return (
    <>
      <PageBreadcrumb items={breadcrumb} />
      <EmptyState Icon={Icon} title={title} description={description} />
    </>
  );
}
