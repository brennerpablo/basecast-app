"use client";

import type { MultilevelHierarchyCellContext } from "../types";

export function defaultHierarchyCell<TPayload>(
  ctx: MultilevelHierarchyCellContext<TPayload>,
) {
  const { node, indentPx } = ctx;
  return (
    <div className="flex min-w-0 items-start gap-1" style={{ paddingLeft: indentPx }}>
      <span className="min-w-0">
        <span className="block truncate font-medium text-foreground">{node.label}</span>
        {node.subtitle ? (
          <span className="block truncate text-xs text-muted-foreground">{node.subtitle}</span>
        ) : null}
        {node.flags?.length ? (
          <span className="mt-0.5 block text-xs text-orange-600">{node.flags.join(" · ")}</span>
        ) : null}
      </span>
    </div>
  );
}
