import type { MultilevelLazyRenderConfig, MultilevelLazyRenderStats, MultilevelRowMeta, MultilevelTreeNode } from "../types";

export const MULTILEVEL_EXPAND_COLUMN_ID = "__expand";
export const MULTILEVEL_HIERARCHY_COLUMN_ID = "__hierarchy";

export type MultilevelFlatRow<TPayload> = TPayload & MultilevelRowMeta;

export function flattenMultilevelTree<TPayload>(
  nodes: MultilevelTreeNode<TPayload>[],
  depth = 0,
): MultilevelFlatRow<TPayload>[] {
  const out: MultilevelFlatRow<TPayload>[] = [];
  for (const node of nodes) {
    out.push({
      ...(node.payload ?? ({} as TPayload)),
      __nodeKey: node.key,
      __label: typeof node.label === "string" ? node.label : String(node.label ?? ""),
      __subtitle:
        node.subtitle != null
          ? typeof node.subtitle === "string"
            ? node.subtitle
            : String(node.subtitle)
          : undefined,
      __hierarchySearch: node.hierarchySearch,
      __flags: node.flags,
      __depth: depth,
    });
    if (node.children?.length) {
      out.push(...flattenMultilevelTree(node.children, depth + 1));
    }
  }
  return out;
}

export function collectAllNodeKeys<TPayload>(
  nodes: MultilevelTreeNode<TPayload>[],
  getNodeId: (node: MultilevelTreeNode<TPayload>) => string,
): Set<string> {
  const keys = new Set<string>();
  const walk = (list: MultilevelTreeNode<TPayload>[]) => {
    for (const node of list) {
      keys.add(getNodeId(node));
      if (node.children?.length) walk(node.children);
    }
  };
  walk(nodes);
  return keys;
}

/** Mantém nós que passaram no filtro ou têm descendentes visíveis. */
export function pruneMultilevelTree<TPayload>(
  nodes: MultilevelTreeNode<TPayload>[],
  visibleKeys: Set<string>,
  getNodeId: (node: MultilevelTreeNode<TPayload>) => string,
): MultilevelTreeNode<TPayload>[] {
  const result: MultilevelTreeNode<TPayload>[] = [];
  for (const node of nodes) {
    const id = getNodeId(node);
    const prunedChildren = node.children?.length
      ? pruneMultilevelTree(node.children, visibleKeys, getNodeId)
      : [];
    const keep = visibleKeys.has(id) || prunedChildren.length > 0;
    if (!keep) continue;
    result.push({
      ...node,
      children: prunedChildren.length > 0 ? prunedChildren : undefined,
    });
  }
  return result;
}

export function childCountFromTree<TPayload>(
  node: MultilevelTreeNode<TPayload>,
): number {
  if (node.descendantCount != null && node.descendantCount > 0) {
    return node.descendantCount;
  }
  return node.children?.length ?? 0;
}

export function countMultilevelTreeRows<TPayload>(
  nodes: MultilevelTreeNode<TPayload>[],
): number {
  let count = 0;
  const walk = (list: MultilevelTreeNode<TPayload>[]) => {
    for (const node of list) {
      count += 1;
      if (node.children?.length) walk(node.children);
    }
  };
  walk(nodes);
  return count;
}

function defaultLazyAggregateNode<TPayload>(args: {
  parent: MultilevelTreeNode<TPayload>;
  omittedCount: number;
}): MultilevelTreeNode<TPayload> {
  return {
    key: `${args.parent.key}::__lazy_omitted`,
    label: `${args.omittedCount.toLocaleString("en-US")} more items`,
    subtitle: "Use filtros para reduzir o volume exibido.",
    level: args.parent.level,
  };
}

export function applyMultilevelLazyRender<TPayload>(
  nodes: MultilevelTreeNode<TPayload>[],
  config: MultilevelLazyRenderConfig<TPayload>,
): { tree: MultilevelTreeNode<TPayload>[]; stats: MultilevelLazyRenderStats } {
  const maxChildrenPerNode = Math.max(1, Math.floor(config.maxChildrenPerNode));
  const stats: MultilevelLazyRenderStats = {
    active: true,
    originalRows: countMultilevelTreeRows(nodes),
    visualRows: 0,
    omittedRows: 0,
    truncatedNodes: 0,
    maxChildrenPerNode,
  };

  const walk = (
    list: MultilevelTreeNode<TPayload>[],
    depth: number,
  ): MultilevelTreeNode<TPayload>[] => {
    return list.map((node) => {
      const walkedChildren = node.children?.length ? walk(node.children, depth + 1) : undefined;
      const nextNode: MultilevelTreeNode<TPayload> = walkedChildren
        ? { ...node, children: walkedChildren }
        : { ...node };

      if (!walkedChildren?.length) return nextNode;
      if (config.shouldLimitNode && !config.shouldLimitNode(nextNode, depth)) return nextNode;
      if (!config.shouldLimitNode && walkedChildren.length <= maxChildrenPerNode) return nextNode;
      if (walkedChildren.length <= maxChildrenPerNode) return nextNode;

      const visibleChildren = walkedChildren.slice(0, maxChildrenPerNode);
      const omittedChildren = walkedChildren.slice(maxChildrenPerNode);
      const omittedCount = countMultilevelTreeRows(omittedChildren);
      const aggregateNode = config.createAggregateNode
        ? config.createAggregateNode({
            parent: nextNode,
            parentDepth: depth,
            visibleChildren,
            omittedChildren,
            omittedCount,
          })
        : defaultLazyAggregateNode({ parent: nextNode, omittedCount });

      stats.omittedRows += omittedCount;
      stats.truncatedNodes += 1;

      return {
        ...nextNode,
        children: [...visibleChildren, aggregateNode],
      };
    });
  };

  const tree = walk(nodes, 0);
  stats.visualRows = countMultilevelTreeRows(tree);
  return { tree, stats };
}
