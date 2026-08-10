import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { rolePrompt, SwarmStore } from "./store.js";

describe("SwarmStore", () => {
  const dirs: string[] = [];
  afterEach(() => {
    for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
  });

  function fresh() {
    const dir = mkdtempSync(join(tmpdir(), "agentgrid-swarm-"));
    dirs.push(dir);
    return new SwarmStore(join(dir, "swarms.json"));
  }

  it("creates a four-role mission draft", () => {
    const store = fresh();
    const draft = store.createDraft({
      name: "Auth cleanup",
      mission: "Fix login edge cases",
    });
    expect(draft.members).toHaveLength(4);
    expect(draft.members.map((m) => m.role).sort()).toEqual([
      "builder",
      "coordinator",
      "reviewer",
      "scout",
    ]);
    store.save(draft);
    expect(store.list()).toHaveLength(1);
  });

  it("enforces file ownership", () => {
    const store = fresh();
    const draft = store.createDraft({ name: "X", mission: "Y" });
    store.save(draft);
    store.claim(draft.id, {
      path: "src/a.ts",
      role: "builder",
      sessionId: "s1",
    });
    expect(() =>
      store.claim(draft.id, {
        path: "src/a.ts",
        role: "reviewer",
        sessionId: "s2",
      }),
    ).toThrow(/already owned/);
  });
});

describe("rolePrompt", () => {
  it("mentions the mission", () => {
    expect(rolePrompt("builder", "Ship payments", "Pay")).toContain("Ship payments");
  });
});
