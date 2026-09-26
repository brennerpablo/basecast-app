"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { MultilevelTreeNode } from "../types";

const DEFAULT_SIGNATURE_IGNORE_LEVELS = ["parcela"] as const;

function nodeHasExpandableChildren<TPayload>(node: MultilevelTreeNode<TPayload>) {
  return (node.descendantCount ?? 0) > 0 || (node.children?.length ?? 0) > 0;
}

function collectInitialExpandedIds<TPayload>(
  nodes: MultilevelTreeNode<TPayload>[],
  getNodeId: (node: MultilevelTreeNode<TPayload>) => string,
  defaultExpandedDepth: number,
  depth = 0,
  out = new Set<string>(),
): Set<string> {
  for (const node of nodes) {
    const hasChildren = nodeHasExpandableChildren(node);
    if (hasChildren && depth < defaultExpandedDepth) {
      out.add(getNodeId(node));
    }
    if (node.children?.length) {
      collectInitialExpandedIds(
        node.children,
        getNodeId,
        defaultExpandedDepth,
        depth + 1,
        out,
      );
    }
  }
  return out;
}

function collectAllNodeIds<TPayload>(
  nodes: MultilevelTreeNode<TPayload>[],
  getNodeId: (node: MultilevelTreeNode<TPayload>) => string,
  out = new Set<string>(),
): Set<string> {
  for (const node of nodes) {
    out.add(getNodeId(node));
    if (node.children?.length) {
      collectAllNodeIds(node.children, getNodeId, out);
    }
  }
  return out;
}

/** Assinatura estável: ignora níveis carregados sob demanda (ex. parcela). */
function treeStructureSignature<TPayload>(
  nodes: MultilevelTreeNode<TPayload>[],
  ignoreLevels: ReadonlySet<string>,
): string {
  const parts: string[] = [];
  const walk = (list: MultilevelTreeNode<TPayload>[]) => {
    for (const node of list) {
      const level = node.level ?? "";
      if (!ignoreLevels.has(level)) {
        parts.push(node.key);
      }
      if (node.children?.length) walk(node.children);
    }
  };
  walk(nodes);
  return parts.join("\0");
}

export function collectExpandableParentIds<TPayload>(
  nodes: MultilevelTreeNode<TPayload>[],
  getNodeId: (node: MultilevelTreeNode<TPayload>) => string,
  out = new Set<string>(),
  depth = 0,
  maxDepth?: number,
): Set<string> {
  for (const node of nodes) {
    if (nodeHasExpandableChildren(node)) {
      if (maxDepth === undefined || depth < maxDepth) {
        out.add(getNodeId(node));
      }
    }
    if (node.children?.length) {
      collectExpandableParentIds(node.children, getNodeId, out, depth + 1, maxDepth);
    }
  }
  return out;
}

function setsEqual(a: Set<string>, b: Set<string>): boolean {
  if (a.size !== b.size) return false;
  for (const id of a) {
    if (!b.has(id)) return false;
  }
  return true;
}

export function useMultilevelExpansion<TPayload>(args: {
  tree: MultilevelTreeNode<TPayload>[];
  getNodeId: (node: MultilevelTreeNode<TPayload>) => string;
  defaultExpandedDepth: number;
  /** Níveis omitidos da assinatura (filhos lazy não resetam expansão). */
  signatureIgnoreLevels?: readonly string[];
  /** Profundidade máxima do “expandir tudo” (0 = só raiz). Omitido = todos os níveis. */
  expandAllMaxDepth?: number;
}) {
  const {
    tree,
    getNodeId,
    defaultExpandedDepth,
    signatureIgnoreLevels = DEFAULT_SIGNATURE_IGNORE_LEVELS,
    expandAllMaxDepth,
  } = args;

  const ignoreLevels = useMemo(
    () => new Set(signatureIgnoreLevels),
    [signatureIgnoreLevels],
  );

  const signature = useMemo(
    () => treeStructureSignature(tree, ignoreLevels),
    [tree, ignoreLevels],
  );

  const treeRef = useRef(tree);
  const getNodeIdRef = useRef(getNodeId);

  useEffect(() => {
    treeRef.current = tree;
    getNodeIdRef.current = getNodeId;
  }, [tree, getNodeId]);

  const [expandedIds, setExpandedIds] = useState<Set<string>>(() =>
    collectInitialExpandedIds(tree, getNodeId, defaultExpandedDepth),
  );

  useEffect(() => {
    const treeNow = treeRef.current;
    const getId = getNodeIdRef.current;
    const initial = collectInitialExpandedIds(treeNow, getId, defaultExpandedDepth);
    const allIds = collectAllNodeIds(treeNow, getId);

    setExpandedIds((prev) => {
      const next = new Set(initial);
      for (const id of prev) {
        if (allIds.has(id)) next.add(id);
      }
      return setsEqual(prev, next) ? prev : next;
    });
  }, [signature, defaultExpandedDepth]);

  const isExpanded = useCallback(
    (nodeId: string) => expandedIds.has(nodeId),
    [expandedIds],
  );

  const toggle = useCallback((nodeId: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(nodeId)) next.delete(nodeId);
      else next.add(nodeId);
      return next;
    });
  }, []);

  const expandAll = useCallback(
    (nodes?: MultilevelTreeNode<TPayload>[]) => {
      const target = nodes ?? treeRef.current;
      setExpandedIds(
        collectExpandableParentIds(
          target,
          getNodeIdRef.current,
          new Set(),
          0,
          expandAllMaxDepth,
        ),
      );
    },
    [expandAllMaxDepth],
  );

  const collapseAll = useCallback(() => {
    setExpandedIds(new Set());
  }, []);

  return { isExpanded, toggle, expandedIds, setExpandedIds, expandAll, collapseAll };
}
