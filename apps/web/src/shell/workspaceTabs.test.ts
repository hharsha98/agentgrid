import { beforeEach, describe, expect, it } from "vitest";
import { createEmptyWorkspace, loadOpenWorkspaces, saveOpenWorkspaces } from "./workspaceTabs";

class MemoryStorage {
  private data = new Map<string, string>();
  getItem(key: string) {
    return this.data.has(key) ? this.data.get(key)! : null;
  }
  setItem(key: string, value: string) {
    this.data.set(key, String(value));
  }
  removeItem(key: string) {
    this.data.delete(key);
  }
  clear() {
    this.data.clear();
  }
}

describe("workspaceTabs", () => {
  beforeEach(() => {
    Object.defineProperty(globalThis, "localStorage", {
      value: new MemoryStorage(),
      configurable: true,
    });
  });

  it("creates an empty workspace with defaults", () => {
    const ws = createEmptyWorkspace("Alpha");
    expect(ws.name).toBe("Alpha");
    expect(ws.sessionIds).toEqual([]);
    expect(ws.layout).toBe(1);
  });

  it("round-trips open workspaces through localStorage", () => {
    const a = createEmptyWorkspace("A");
    const b = createEmptyWorkspace("B", { sessionIds: ["s1"] });
    saveOpenWorkspaces([a, b], b.id);
    const loaded = loadOpenWorkspaces("fallback");
    expect(loaded.tabs).toHaveLength(2);
    expect(loaded.activeId).toBe(b.id);
    expect(loaded.tabs.find((t) => t.id === b.id)?.sessionIds).toEqual(["s1"]);
  });
});
