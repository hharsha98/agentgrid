import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const src = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "index.ts"), "utf8");

describe("agentgrid mcp tools", () => {
  it("exposes memory + live API tools", () => {
    for (const name of [
      "memory_list",
      "memory_read",
      "memory_write",
      "memory_delete",
      "health",
      "agents_list",
      "sessions_list",
      "fs_roots",
      "fs_tree",
      "fs_read",
      "kanban_list",
      "kanban_create",
      "swarm_list",
      "skills_list",
      "workspaces_list",
      "fs_write",
    ]) {
      expect(src).toContain(`name: "${name}"`);
    }
  });
});
