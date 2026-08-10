import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { PromptStore } from "./store.js";

describe("PromptStore", () => {
  const dirs: string[] = [];
  afterEach(() => {
    for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
  });

  function fresh() {
    const dir = mkdtempSync(join(tmpdir(), "agentgrid-prompts-"));
    dirs.push(dir);
    return new PromptStore(join(dir, "prompts.json"));
  }

  it("upserts, lists, and removes prompts", () => {
    const store = fresh();
    const created = store.upsert({ name: "Explain", body: "Explain this file" });
    expect(created.id).toBeTruthy();
    expect(store.list()).toHaveLength(1);
    expect(store.get(created.id)?.body).toBe("Explain this file");
    expect(store.remove(created.id)).toBe(true);
    expect(store.list()).toHaveLength(0);
  });

  it("rejects empty name or body", () => {
    const store = fresh();
    expect(() => store.upsert({ name: " ", body: "x" })).toThrow(/name/);
    expect(() => store.upsert({ name: "x", body: "  " })).toThrow(/body/);
  });
});
