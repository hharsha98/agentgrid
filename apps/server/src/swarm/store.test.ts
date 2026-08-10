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
    expect(draft.mailbox).toEqual([]);
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

  it("posts mailbox messages", () => {
    const store = fresh();
    const draft = store.createDraft({ name: "M", mission: "Do it" });
    store.save(draft);
    const next = store.postMail(draft.id, { fromRole: "human", body: "hello team" });
    expect(next.mailbox).toHaveLength(1);
    expect(next.mailbox[0]?.body).toBe("hello team");
  });

  it("updates plan node status", () => {
    const store = fresh();
    const draft = store.createDraft({ name: "Plan", mission: "Ship" });
    store.save(draft);
    expect(draft.plan.length).toBe(4);
    const nodeId = draft.plan[0]!.id;
    const next = store.setPlanNodeStatus(draft.id, nodeId, "doing");
    expect(next.plan.find((n) => n.id === nodeId)?.status).toBe("doing");
  });
});

describe("rolePrompt", () => {
  it("mentions the mission", () => {
    expect(rolePrompt("builder", "Ship payments", "Pay")).toContain("Ship payments");
  });
});
