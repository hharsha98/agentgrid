/** Nested split-tree layout for freeform panes (BridgeSpace-style). */

export type SplitDirection = "row" | "col";

export interface LeafPane {
  type: "leaf";
  id: string;
  sessionId: string | null;
}

export interface SplitPane {
  type: "split";
  id: string;
  direction: SplitDirection;
  /** Fraction for the first child (0.15–0.85). */
  ratio: number;
  a: PaneNode;
  b: PaneNode;
}

export type PaneNode = LeafPane | SplitPane;

export function newId(): string {
  return `p_${Math.random().toString(36).slice(2, 10)}`;
}

export function leaf(sessionId: string | null = null): LeafPane {
  return { type: "leaf", id: newId(), sessionId };
}

export function defaultTree(sessionIds: string[]): PaneNode {
  if (sessionIds.length === 0) return leaf(null);
  if (sessionIds.length === 1) return leaf(sessionIds[0] ?? null);
  // Build a balanced row/col tree
  let node: PaneNode = leaf(sessionIds[0] ?? null);
  for (let i = 1; i < sessionIds.length; i++) {
    node = {
      type: "split",
      id: newId(),
      direction: i % 2 === 0 ? "col" : "row",
      ratio: 0.5,
      a: node,
      b: leaf(sessionIds[i] ?? null),
    };
  }
  return node;
}

export function splitLeaf(
  root: PaneNode,
  leafId: string,
  direction: SplitDirection,
  sessionId: string | null = null,
): PaneNode {
  const walk = (n: PaneNode): PaneNode => {
    if (n.type === "leaf") {
      if (n.id !== leafId) return n;
      return {
        type: "split",
        id: newId(),
        direction,
        ratio: 0.5,
        a: n,
        b: leaf(sessionId),
      };
    }
    return { ...n, a: walk(n.a), b: walk(n.b) };
  };
  return walk(root);
}

export function setRatio(root: PaneNode, splitId: string, ratio: number): PaneNode {
  const clamped = Math.min(0.85, Math.max(0.15, ratio));
  const walk = (n: PaneNode): PaneNode => {
    if (n.type === "leaf") return n;
    if (n.id === splitId) return { ...n, ratio: clamped };
    return { ...n, a: walk(n.a), b: walk(n.b) };
  };
  return walk(root);
}

export function assignSession(root: PaneNode, leafId: string, sessionId: string | null): PaneNode {
  const walk = (n: PaneNode): PaneNode => {
    if (n.type === "leaf") {
      return n.id === leafId ? { ...n, sessionId } : n;
    }
    return { ...n, a: walk(n.a), b: walk(n.b) };
  };
  return walk(root);
}

export function listLeaves(root: PaneNode): LeafPane[] {
  if (root.type === "leaf") return [root];
  return [...listLeaves(root.a), ...listLeaves(root.b)];
}

export function fillEmptyLeaves(root: PaneNode, sessionIds: string[]): PaneNode {
  const leaves = listLeaves(root);
  const used = new Set(leaves.map((l) => l.sessionId).filter(Boolean) as string[]);
  const free = sessionIds.filter((id) => !used.has(id));
  let i = 0;
  const walk = (n: PaneNode): PaneNode => {
    if (n.type === "leaf") {
      if (n.sessionId) return n;
      const next = free[i++];
      return next ? { ...n, sessionId: next } : n;
    }
    return { ...n, a: walk(n.a), b: walk(n.b) };
  };
  return walk(root);
}
