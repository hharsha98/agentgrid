import { describe, expect, it } from "vitest";
import { SkillStore } from "./store.js";

describe("SkillStore", () => {
  it("loads bundled skills", () => {
    const store = new SkillStore();
    const skills = store.list();
    expect(skills.length).toBeGreaterThanOrEqual(3);
    expect(skills.some((s) => s.id === "security-review")).toBe(true);
    expect(store.get("commit-and-push")?.prompt.length).toBeGreaterThan(20);
  });
});
