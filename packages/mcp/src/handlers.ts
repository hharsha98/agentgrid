import { homedir } from "node:os";
import { join } from "node:path";
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { DEFAULT_SERVER_PORT } from "@agentgrid/shared";
import type { JsonRpcRequest } from "./framing.js";

export const MCP_VERSION = "0.2.0";

export type Json = Record<string, unknown>;

export function defaultMemoryDir(): string {
  return join(homedir(), ".agentgrid", "memory");
}

export function defaultApiBase(): string {
  const port = process.env.AGENTGRID_PORT ?? String(DEFAULT_SERVER_PORT);
  return `http://127.0.0.1:${port}`;
}

function textResult(payload: unknown, isError = false) {
  const text = typeof payload === "string" ? payload : JSON.stringify(payload, null, 2);
  return { content: [{ type: "text" as const, text }], isError };
}

function listNotes(memoryDir: string) {
  if (!existsSync(memoryDir)) return [];
  return readdirSync(memoryDir)
    .filter((n) => n.endsWith(".md"))
    .map((n) => {
      const id = n.slice(0, -3);
      const content = readFileSync(join(memoryDir, n), "utf8");
      const title = content.startsWith("# ")
        ? content.split("\n")[0]!.replace(/^#\s+/, "")
        : id;
      return { id, title, path: join(memoryDir, n) };
    });
}

function readNote(memoryDir: string, id: string) {
  const safe = id.replace(/[^a-zA-Z0-9_-]/g, "");
  const abs = join(memoryDir, `${safe}.md`);
  if (!existsSync(abs)) throw new Error(`note not found: ${id}`);
  return { id: safe, content: readFileSync(abs, "utf8"), path: abs };
}

function writeNote(memoryDir: string, id: string, content: string) {
  const safe = id.replace(/[^a-zA-Z0-9_-]/g, "");
  if (!safe) throw new Error("invalid id");
  mkdirSync(memoryDir, { recursive: true });
  const abs = join(memoryDir, `${safe}.md`);
  writeFileSync(abs, content, "utf8");
  return { id: safe, path: abs };
}

function deleteNote(memoryDir: string, id: string) {
  const safe = id.replace(/[^a-zA-Z0-9_-]/g, "");
  const abs = join(memoryDir, `${safe}.md`);
  if (!existsSync(abs)) throw new Error(`note not found: ${id}`);
  unlinkSync(abs);
  return { id: safe, deleted: true };
}

export const TOOLS = [
  {
    name: "memory_list",
    description: "List shared agentgrid memory notes (~/.agentgrid/memory)",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "memory_read",
    description: "Read a shared memory note by id",
    inputSchema: {
      type: "object",
      properties: { id: { type: "string" } },
      required: ["id"],
    },
  },
  {
    name: "memory_write",
    description: "Write/overwrite a shared memory note",
    inputSchema: {
      type: "object",
      properties: { id: { type: "string" }, content: { type: "string" } },
      required: ["id", "content"],
    },
  },
  {
    name: "memory_delete",
    description: "Delete a shared memory note by id",
    inputSchema: {
      type: "object",
      properties: { id: { type: "string" } },
      required: ["id"],
    },
  },
  {
    name: "health",
    description: "Check whether the agentgrid Fastify server is online on :4318",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "agents_list",
    description: "List available coding agents and whether they are installed",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "sessions_list",
    description: "List live PTY sessions managed by the agentgrid server",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "fs_roots",
    description: "List allowed filesystem roots for the Files view",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "fs_tree",
    description: "List directory entries under an allowed root",
    inputSchema: {
      type: "object",
      properties: {
        root: { type: "string" },
        path: { type: "string", description: "Relative path inside root (default .)" },
      },
      required: ["root"],
    },
  },
  {
    name: "fs_read",
    description: "Read a text file under an allowed root",
    inputSchema: {
      type: "object",
      properties: {
        root: { type: "string" },
        path: { type: "string" },
      },
      required: ["root", "path"],
    },
  },
  {
    name: "kanban_list",
    description: "List kanban cards from the agentgrid board",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "kanban_create",
    description: "Create a kanban card (column: todo | in_progress | in_review | done)",
    inputSchema: {
      type: "object",
      properties: {
        title: { type: "string" },
        body: { type: "string" },
        column: { type: "string", description: "todo | in_progress | in_review | done" },
        agentId: { type: "string" },
      },
      required: ["title"],
    },
  },
  {
    name: "swarm_list",
    description: "List swarm missions and their roles",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "skills_list",
    description: "List bundled skills that can be applied to a pane",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "workspaces_list",
    description: "List saved workspace templates",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "fs_write",
    description: "Write a text file under an allowed root",
    inputSchema: {
      type: "object",
      properties: {
        root: { type: "string" },
        path: { type: "string" },
        content: { type: "string" },
      },
      required: ["root", "path", "content"],
    },
  },
  {
    name: "skills_apply",
    description: "Apply a bundled skill prompt into a live session pane",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string" },
        sessionId: { type: "string" },
      },
      required: ["id", "sessionId"],
    },
  },
  {
    name: "swarm_create",
    description: "Launch a 4-role swarm mission",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string" },
        mission: { type: "string" },
        cwd: { type: "string" },
      },
      required: ["name", "mission"],
    },
  },
  {
    name: "kanban_dispatch",
    description: "Dispatch a kanban card into a new agent session",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string" },
        cwd: { type: "string" },
      },
      required: ["id"],
    },
  },
] as const;

export interface McpContext {
  memoryDir: string;
  apiBase: string;
  fetchImpl?: typeof fetch;
}

async function api<T>(ctx: McpContext, path: string, init?: RequestInit): Promise<T> {
  const fetchFn = ctx.fetchImpl ?? fetch;
  const res = await fetchFn(`${ctx.apiBase}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = (await res.json()) as { error?: string };
      detail = body.error ?? detail;
    } catch {
      // ignore
    }
    throw new Error(`API ${path}: ${detail}`);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export type RpcResponse =
  | { kind: "result"; id: unknown; result: unknown }
  | { kind: "error"; id: unknown; message: string }
  | { kind: "none" };

export async function handleRpc(msg: JsonRpcRequest, ctx: McpContext): Promise<RpcResponse> {
  const method = String(msg.method ?? "");
  const id = msg.id;
  const params = (msg.params ?? {}) as Json;

  if (method === "initialize") {
    return {
      kind: "result",
      id,
      result: {
        protocolVersion: "2024-11-05",
        capabilities: { tools: {} },
        serverInfo: { name: "agentgrid", version: MCP_VERSION },
      },
    };
  }
  if (method === "notifications/initialized" || method === "initialized") {
    return { kind: "none" };
  }
  if (method === "tools/list") {
    return { kind: "result", id, result: { tools: TOOLS } };
  }
  if (method === "ping") {
    return { kind: "result", id, result: {} };
  }
  if (method === "tools/call") {
    const name = String(params.name ?? "");
    const args = (params.arguments ?? {}) as Json;
    try {
      const result = await callTool(name, args, ctx);
      return { kind: "result", id, result };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { kind: "result", id, result: textResult(message, true) };
    }
  }
  if (id !== undefined) return { kind: "error", id, message: `unsupported method: ${method}` };
  return { kind: "none" };
}

export async function callTool(name: string, args: Json, ctx: McpContext): Promise<unknown> {
  const memoryDir = ctx.memoryDir;
  if (name === "memory_list") return textResult(listNotes(memoryDir));
  if (name === "memory_read") return textResult(readNote(memoryDir, String(args.id ?? "")).content);
  if (name === "memory_write") {
    const saved = writeNote(memoryDir, String(args.id ?? ""), String(args.content ?? ""));
    return textResult(`wrote ${saved.path}`);
  }
  if (name === "memory_delete") return textResult(deleteNote(memoryDir, String(args.id ?? "")));
  if (name === "health") {
    const body = await api<{ ok: boolean; service?: string }>(ctx, "/api/health");
    return textResult(body);
  }
  if (name === "agents_list") {
    const body = await api<{ agents: unknown[] }>(ctx, "/api/agents");
    return textResult(body.agents);
  }
  if (name === "sessions_list") {
    const body = await api<{ sessions: unknown[] }>(ctx, "/api/sessions");
    return textResult(body.sessions);
  }
  if (name === "fs_roots") {
    const body = await api<{ roots: string[] }>(ctx, "/api/fs/roots");
    return textResult(body.roots);
  }
  if (name === "fs_tree") {
    const root = encodeURIComponent(String(args.root ?? ""));
    const path = encodeURIComponent(String(args.path ?? "."));
    const body = await api<{ entries: unknown[] }>(ctx, `/api/fs/tree?root=${root}&path=${path}`);
    return textResult(body.entries);
  }
  if (name === "fs_read") {
    const root = encodeURIComponent(String(args.root ?? ""));
    const path = encodeURIComponent(String(args.path ?? ""));
    const body = await api<{ file: { content: string; path: string } }>(
      ctx,
      `/api/fs/file?root=${root}&path=${path}`,
    );
    return textResult(body.file);
  }
  if (name === "kanban_list") {
    const body = await api<{ cards: unknown[] }>(ctx, "/api/kanban");
    return textResult(body.cards);
  }
  if (name === "kanban_create") {
    const body = await api<{ card: unknown }>(ctx, "/api/kanban/cards", {
      method: "POST",
      body: JSON.stringify({
        title: String(args.title ?? ""),
        body: args.body != null ? String(args.body) : undefined,
        column: args.column != null ? String(args.column) : undefined,
        agentId: args.agentId != null ? String(args.agentId) : undefined,
      }),
    });
    return textResult(body.card);
  }
  if (name === "swarm_list") {
    const body = await api<{ swarms: unknown[] }>(ctx, "/api/swarm");
    return textResult(body.swarms);
  }
  if (name === "skills_list") {
    const body = await api<{ skills: unknown[] }>(ctx, "/api/skills");
    return textResult(body.skills);
  }
  if (name === "workspaces_list") {
    const body = await api<{ workspaces: unknown[] }>(ctx, "/api/workspaces");
    return textResult(body.workspaces);
  }
  if (name === "fs_write") {
    const body = await api<{ file: unknown }>(ctx, "/api/fs/file", {
      method: "PUT",
      body: JSON.stringify({
        root: String(args.root ?? ""),
        path: String(args.path ?? ""),
        content: String(args.content ?? ""),
      }),
    });
    return textResult(body.file);
  }
  if (name === "skills_apply") {
    const skillId = encodeURIComponent(String(args.id ?? ""));
    const body = await api<{ skill: unknown }>(ctx, `/api/skills/${skillId}/apply`, {
      method: "POST",
      body: JSON.stringify({ sessionId: String(args.sessionId ?? "") }),
    });
    return textResult(body.skill);
  }
  if (name === "swarm_create") {
    const body = await api<{ swarm: unknown }>(ctx, "/api/swarm", {
      method: "POST",
      body: JSON.stringify({
        name: String(args.name ?? ""),
        mission: String(args.mission ?? ""),
        cwd: args.cwd != null ? String(args.cwd) : undefined,
      }),
    });
    return textResult(body.swarm);
  }
  if (name === "kanban_dispatch") {
    const cardId = encodeURIComponent(String(args.id ?? ""));
    const body = await api<{ card: unknown; session: unknown }>(
      ctx,
      `/api/kanban/cards/${cardId}/dispatch`,
      {
        method: "POST",
        body: JSON.stringify({ cwd: args.cwd != null ? String(args.cwd) : undefined }),
      },
    );
    return textResult(body);
  }
  throw new Error(`unknown tool: ${name}`);
}

export function encodeResponse(resp: RpcResponse): unknown | null {
  if (resp.kind === "none") return null;
  if (resp.kind === "error") {
    return { jsonrpc: "2.0", id: resp.id, error: { code: -32000, message: resp.message } };
  }
  return { jsonrpc: "2.0", id: resp.id, result: resp.result };
}
