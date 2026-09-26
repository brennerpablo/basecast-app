import type { MultilevelTreeNode } from "../types";

function nodeLevel(node: MultilevelTreeNode<unknown>): string {
  return node.level?.trim() || "";
}

/**
 * Remove níveis desmarcados promovendo filhos ao ancestral visível (a árvore não "quebra").
 */
export function filterMultilevelTreeByLevels<TPayload>(
  nodes: MultilevelTreeNode<TPayload>[],
  visibleLevelIds: ReadonlySet<string>,
): MultilevelTreeNode<TPayload>[] {
  const process = (node: MultilevelTreeNode<TPayload>): MultilevelTreeNode<TPayload>[] => {
    const level = nodeLevel(node);
    const childNodes = node.children ?? [];
    const processedChildren = childNodes.flatMap((child) => process(child));

    const levelVisible = !level || visibleLevelIds.has(level);

    if (levelVisible) {
      return [
        {
          ...node,
          children: processedChildren.length > 0 ? processedChildren : undefined,
        },
      ];
    }

    return processedChildren;
  };

  return nodes.flatMap((node) => process(node));
}

export function defaultVisibleLevelIds(
  levels: ReadonlyArray<{ id: string; defaultVisible?: boolean }>,
): string[] {
  const visible = levels
    .flatMap((level) => level.defaultVisible !== false ? [level.id] : []);
  return visible.length > 0 ? visible : levels.map((level) => level.id);
}
