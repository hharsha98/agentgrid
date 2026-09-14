import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { TOOLS, callTool, handleRpc, type McpContext } from "./handlers.js";

describe("agentgrid mcp tools", () => {
  const dirs: string[] = [];
  afterEach(() => {
    for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
  });

  function ctx(): McpContext {
    const dir = mkdtempSync(join(tmpdir(), "agentgrid-mcp-"));
    dirs.push(dir);
    return { memoryDir: dir, apiBase: "http://127.0.0.1:4318" };
  }

  it("advertises memory + live API tools with honest kanban columns", () => {
    const names = TOOLS.map((t) => t.name);
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
      "fs_write",
      "kanban_list",
      "kanban_create",
      "kanban_dispatch",
      "swarm_list",
      "skills_list",
      "workspaces_list",
    ]) {
      expect(names).toContain(name);
    }
    const create = TOOLS.find((t) => t.name === "kanban_create");
    expect(create?.description).toMatch(/todo/);
    expect(create?.description).not.toMatch(/backlog/);
  });

  it("round-trips local memory notes without the HTTP API", async () => {
    const c = ctx();
    await callTool("memory_write", { id: "decisions", content: "# Decisions\n\npnpm\n" }, c);
    const listed = (await callTool("memory_list", {}, c)) as {
      content: Array<{ text: string }>;
    };
    expect(listed.content[0]?.text).toContain("decisions");
    const read = (await callTool("memory_read", { id: "decisions" }, c)) as {
      content: Array<{ text: string }>;
    };
    expect(read.content[0]?.text).toContain("pnpm");
    await callTool("memory_delete", { id: "decisions" }, c);
    const after = (await callTool("memory_list", {}, c)) as {
      content: Array<{ text: string }>;
    };
    expect(after.content[0]?.text).toBe("[]");
  });

  it("initialize + tools/list are JSON-RPC results", async () => {
    const init = await handleRpc({ jsonrpc: "2.0", id: 1, method: "initialize" }, ctx());
    expect(init.kind).toBe("result");
    const list = await handleRpc({ jsonrpc: "2.0", id: 2, method: "tools/list" }, ctx());
    expect(list.kind).toBe("result");
    if (list.kind === "result") {
      const tools = (list.result as { tools: { name: string }[] }).tools;
      expect(tools.length).toBeGreaterThan(8);
    }
  });

  it("returns isError tool results when the live API is down", async () => {
    const c = ctx();
    const resp = await handleRpc(
      {
        jsonrpc: "2.0",
        id: 3,
        method: "tools/call",
        params: { name: "health", arguments: {} },
      },
      c,
    );
    expect(resp.kind).toBe("result");
    if (resp.kind === "result") {
      const result = resp.result as { isError?: boolean; content: Array<{ text: string }> };
      expect(result.isError).toBe(true);
      expect(result.content[0]?.text.length).toBeGreaterThan(0);
    }
  });

  it("does not reply to notifications/initialized", async () => {
    const resp = await handleRpc({ jsonrpc: "2.0", method: "notifications/initialized" }, ctx());
    expect(resp.kind).toBe("none");
  });
});
