import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { KanbanStore, seedDemoBoard } from "./store.js";

describe("KanbanStore", () => {
  const dirs: string[] = [];
  afterEach(() => {
    for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
  });

  function fresh() {
    const dir = mkdtempSync(join(tmpdir(), "agentgrid-kanban-"));
    dirs.push(dir);
    return new KanbanStore(join(dir, "kanban.json"));
  }

  it("creates cards in todo by default with shell agent", () => {
    const store = fresh();
    const card = store.upsert({ title: "Fix login" });
    expect(card.column).toBe("todo");
    expect(card.agentId).toBe("shell");
    expect(store.list()).toHaveLength(1);
  });

  it("moves columns and attaches session ids", () => {
    const store = fresh();
    const card = store.upsert({ title: "Ship", agentId: "shell" });
    const moved = store.update(card.id, {
      column: "in_progress",
      sessionId: "sess-1",
    });
    expect(moved?.column).toBe("in_progress");
    expect(moved?.sessionId).toBe("sess-1");
  });

  it("seeds a demo board only when empty", () => {
    const store = fresh();
    expect(seedDemoBoard(store)).toBe(true);
    expect(store.list()).toHaveLength(3);
    expect(store.list().every((c) => c.column === "todo")).toBe(true);
    expect(seedDemoBoard(store)).toBe(false);
    expect(store.list()).toHaveLength(3);
  });

  it("does not overwrite a kanban file that cannot be parsed", () => {
    const dir = mkdtempSync(join(tmpdir(), "agentgrid-kanban-"));
    dirs.push(dir);
    const path = join(dir, "kanban.json");
    writeFileSync(path, "{not json\n", "utf8");
    const store = new KanbanStore(path);
    expect(seedDemoBoard(store)).toBe(false);
    expect(readFileSync(path, "utf8")).toBe("{not json\n");
  });
});
