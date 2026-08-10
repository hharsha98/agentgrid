import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { MemoryStore } from "./store.js";

describe("MemoryStore", () => {
  const dirs: string[] = [];
  afterEach(() => {
    for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
  });

  function fresh() {
    const dir = mkdtempSync(join(tmpdir(), "agentgrid-mem-"));
    dirs.push(dir);
    return new MemoryStore(dir);
  }

  it("creates and lists notes", () => {
    const store = fresh();
    const note = store.upsert({ title: "Auth decisions" });
    expect(note.content.startsWith("# Auth decisions")).toBe(true);
    expect(store.list()).toHaveLength(1);
    expect(store.get(note.id)?.title).toBe("Auth decisions");
  });

  it("updates content", () => {
    const store = fresh();
    const note = store.upsert({ title: "API", content: "# API\n\nv1 only\n" });
    const next = store.upsert({ id: note.id, title: "API", content: "# API\n\nv2\n" });
    expect(next.content).toContain("v2");
    expect(store.list()).toHaveLength(1);
  });
});
