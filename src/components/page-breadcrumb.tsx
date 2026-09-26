"use client";

import { Fragment, useEffect, useMemo } from "react";

import {
  type BreadcrumbEntry,
  useBreadcrumbContext,
} from "@/components/breadcrumb-context";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Separator } from "@/components/ui/separator";

interface PageBreadcrumbProps {
  items: BreadcrumbEntry[];
}

/**
 * Declares breadcrumb items for the current page.
 * Items are rendered in the layout topbar via BreadcrumbBar.
 * This component renders nothing itself.
 */
export function PageBreadcrumb({ items }: PageBreadcrumbProps) {
  const { setItems } = useBreadcrumbContext();

  // Keyed by value, not identity: pages pass the array inline, and a new array
  // on every parent render would re-run the effect (clear, then set the same
  // trail again).
  const key = JSON.stringify(items.map((item) => [item.label, item.href ?? null]));
  const trail = useMemo(
    () =>
      (JSON.parse(key) as [string, string | null][]).map(([label, href]) =>
        href === null ? { label } : { label, href },
      ),
    [key],
  );

  useEffect(() => {
    setItems(trail);
    return () => setItems([]);
  }, [trail, setItems]);

  return null;
}

/**
 * Renders the breadcrumb bar. `inline` (the default) sits in the mobile toolbar
 * row after the sidebar trigger, so it leads with a vertical rule; `title` is
 * the desktop form, alone above the page content as its title.
 */
export function BreadcrumbBar({
  variant = "inline",
}: {
  variant?: "inline" | "title";
}) {
  const { items } = useBreadcrumbContext();

  if (items.length === 0) return null;

  return (
    <>
      {variant === "inline" && (
        <Separator orientation="vertical" className="h-4" />
      )}
      <Breadcrumb className={variant === "title" ? "mb-4" : undefined}>
        <BreadcrumbList>
          {items.map((item, index) => (
            <Fragment key={`${item.href ?? ""}|${item.label}`}>
              {index > 0 && <BreadcrumbSeparator />}
              <BreadcrumbItem>
                {item.href ? (
                  <BreadcrumbLink href={item.href}>{item.label}</BreadcrumbLink>
                ) : (
                  <BreadcrumbPage>{item.label}</BreadcrumbPage>
                )}
              </BreadcrumbItem>
            </Fragment>
          ))}
        </BreadcrumbList>
      </Breadcrumb>
    </>
  );
}

export type { BreadcrumbEntry };
