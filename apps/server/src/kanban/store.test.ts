import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { KanbanStore } from "./store.js";

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

  it("creates cards in todo by default", () => {
    const store = fresh();
    const card = store.upsert({ title: "Fix login" });
    expect(card.column).toBe("todo");
    expect(card.agentId).toBe("claude");
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
});
