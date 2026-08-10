import { describe, expect, it } from "vitest";
import {
  assignSession,
  defaultTree,
  fillEmptyLeaves,
  listLeaves,
  setRatio,
  splitLeaf,
} from "./splitTree";

describe("splitTree", () => {
  it("builds a default tree from session ids", () => {
    const tree = defaultTree(["a", "b", "c"]);
    const leaves = listLeaves(tree);
    expect(leaves).toHaveLength(3);
    expect(leaves.map((l) => l.sessionId)).toEqual(["a", "b", "c"]);
  });

  it("splits a leaf and assigns sessions", () => {
    let tree = defaultTree(["a"]);
    const leafId = listLeaves(tree)[0]!.id;
    tree = splitLeaf(tree, leafId, "col");
    expect(listLeaves(tree)).toHaveLength(2);
    const empty = listLeaves(tree).find((l) => !l.sessionId)!;
    tree = assignSession(tree, empty.id, "b");
    expect(listLeaves(tree).map((l) => l.sessionId).sort()).toEqual(["a", "b"]);
  });

  it("clamps ratios and fills empty leaves", () => {
    let tree = defaultTree(["a"]);
    const leafId = listLeaves(tree)[0]!.id;
    tree = splitLeaf(tree, leafId, "row");
    const splitId = tree.type === "split" ? tree.id : "";
    tree = setRatio(tree, splitId, 0.01);
    expect(tree.type === "split" && tree.ratio).toBe(0.15);
    tree = fillEmptyLeaves(tree, ["a", "b"]);
    expect(listLeaves(tree).some((l) => l.sessionId === "b")).toBe(true);
  });
});
