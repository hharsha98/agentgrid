import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { WorkspaceStore } from "./store.js";

describe("WorkspaceStore", () => {
  const dirs: string[] = [];

  afterEach(() => {
    for (const d of dirs.splice(0)) {
      rmSync(d, { recursive: true, force: true });
    }
  });

  function fresh() {
    const dir = mkdtempSync(join(tmpdir(), "agentgrid-ws-"));
    dirs.push(dir);
    return new WorkspaceStore(join(dir, "workspaces.json"));
  }

  it("upserts and lists workspaces", () => {
    const store = fresh();
    const created = store.upsert({
      name: "UI cleanup",
      layout: 2,
      cwd: "/tmp",
      panes: [
        { agentId: "claude", title: "frontend" },
        { agentId: "codex", title: "tests" },
      ],
    });
    expect(created.id).toBeTruthy();
    expect(store.list()).toHaveLength(1);
    expect(store.get(created.id)?.name).toBe("UI cleanup");
  });

  it("updates in place when id is provided", () => {
    const store = fresh();
    const first = store.upsert({
      name: "A",
      layout: 1,
      panes: [{ agentId: "shell" }],
    });
    const second = store.upsert({
      id: first.id,
      name: "B",
      layout: 2,
      panes: [{ agentId: "shell" }, { agentId: "shell" }],
    });
    expect(second.id).toBe(first.id);
    expect(store.list()).toHaveLength(1);
    expect(store.get(first.id)?.name).toBe("B");
  });

  it("removes workspaces", () => {
    const store = fresh();
    const created = store.upsert({
      name: "gone",
      layout: 1,
      panes: [{ agentId: "shell" }],
    });
    expect(store.remove(created.id)).toBe(true);
    expect(store.list()).toHaveLength(0);
  });
});
