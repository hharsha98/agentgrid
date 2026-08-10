#!/usr/bin/env node
/**
 * STDIO MCP server for agentgrid.
 *
 * Local tools talk to ~/.agentgrid (memory).
 * Live tools call the Fastify API on 127.0.0.1:4318 when the server is up.
 *
 * Configure Claude Code / Cursor:
 *   command: pnpm
 *   args: ["--filter", "@agentgrid/mcp", "start"]
 *   cwd: /path/to/agentgrid
 */
import { createInterface } from "node:readline";
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

const memoryDir = join(homedir(), ".agentgrid", "memory");
mkdirSync(memoryDir, { recursive: true });
const apiBase = `http://127.0.0.1:${DEFAULT_SERVER_PORT}`;

type Json = Record<string, unknown>;

function respond(id: unknown, result: unknown) {
  process.stdout.write(JSON.stringify({ jsonrpc: "2.0", id, result }) + "\n");
}

function respondError(id: unknown, message: string) {
  process.stdout.write(
    JSON.stringify({
      jsonrpc: "2.0",
      id,
      error: { code: -32000, message },
    }) + "\n",
  );
}

function textResult(payload: unknown) {
  const text = typeof payload === "string" ? payload : JSON.stringify(payload, null, 2);
  return { content: [{ type: "text", text }] };
}

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${apiBase}${path}`, {
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

function listNotes() {
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

function readNote(id: string) {
  const safe = id.replace(/[^a-zA-Z0-9_-]/g, "");
  const abs = join(memoryDir, `${safe}.md`);
  if (!existsSync(abs)) throw new Error(`note not found: ${id}`);
  return { id: safe, content: readFileSync(abs, "utf8"), path: abs };
}

function writeNote(id: string, content: string) {
  const safe = id.replace(/[^a-zA-Z0-9_-]/g, "");
  if (!safe) throw new Error("invalid id");
  const abs = join(memoryDir, `${safe}.md`);
  writeFileSync(abs, content, "utf8");
  return { id: safe, path: abs };
}

function deleteNote(id: string) {
  const safe = id.replace(/[^a-zA-Z0-9_-]/g, "");
  const abs = join(memoryDir, `${safe}.md`);
  if (!existsSync(abs)) throw new Error(`note not found: ${id}`);
  unlinkSync(abs);
  return { id: safe, deleted: true };
}

const tools = [
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
    description: "Create a kanban card (column: backlog|doing|review|done)",
    inputSchema: {
      type: "object",
      properties: {
        title: { type: "string" },
        body: { type: "string" },
        column: { type: "string" },
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
];

async function handle(msg: Json) {
  const method = String(msg.method ?? "");
  const id = msg.id;
  const params = (msg.params ?? {}) as Json;

  if (method === "initialize") {
    respond(id, {
      protocolVersion: "2024-11-05",
      capabilities: { tools: {} },
      serverInfo: { name: "agentgrid", version: "0.2.0" },
    });
    return;
  }
  if (method === "notifications/initialized" || method === "initialized") return;
  if (method === "tools/list") {
    respond(id, { tools });
    return;
  }
  if (method === "tools/call") {
    const name = String(params.name ?? "");
    const args = (params.arguments ?? {}) as Json;
    try {
      if (name === "memory_list") {
        respond(id, textResult(listNotes()));
      } else if (name === "memory_read") {
        respond(id, textResult(readNote(String(args.id ?? "")).content));
      } else if (name === "memory_write") {
        const saved = writeNote(String(args.id ?? ""), String(args.content ?? ""));
        respond(id, textResult(`wrote ${saved.path}`));
      } else if (name === "memory_delete") {
        respond(id, textResult(deleteNote(String(args.id ?? ""))));
      } else if (name === "health") {
        const body = await api<{ ok: boolean; service?: string }>("/api/health");
        respond(id, textResult(body));
      } else if (name === "agents_list") {
        const body = await api<{ agents: unknown[] }>("/api/agents");
        respond(id, textResult(body.agents));
      } else if (name === "sessions_list") {
        const body = await api<{ sessions: unknown[] }>("/api/sessions");
        respond(id, textResult(body.sessions));
      } else if (name === "fs_roots") {
        const body = await api<{ roots: string[] }>("/api/fs/roots");
        respond(id, textResult(body.roots));
      } else if (name === "fs_tree") {
        const root = encodeURIComponent(String(args.root ?? ""));
        const path = encodeURIComponent(String(args.path ?? "."));
        const body = await api<{ entries: unknown[] }>(`/api/fs/tree?root=${root}&path=${path}`);
        respond(id, textResult(body.entries));
      } else if (name === "fs_read") {
        const root = encodeURIComponent(String(args.root ?? ""));
        const path = encodeURIComponent(String(args.path ?? ""));
        const body = await api<{ file: { content: string; path: string } }>(
          `/api/fs/file?root=${root}&path=${path}`,
        );
        respond(id, textResult(body.file));
      } else if (name === "kanban_list") {
        const body = await api<{ cards: unknown[] }>("/api/kanban");
        respond(id, textResult(body.cards));
      } else if (name === "kanban_create") {
        const body = await api<{ card: unknown }>("/api/kanban/cards", {
          method: "POST",
          body: JSON.stringify({
            title: String(args.title ?? ""),
            body: args.body != null ? String(args.body) : undefined,
            column: args.column != null ? String(args.column) : undefined,
            agentId: args.agentId != null ? String(args.agentId) : undefined,
          }),
        });
        respond(id, textResult(body.card));
      } else if (name === "swarm_list") {
        const body = await api<{ swarms: unknown[] }>("/api/swarm");
        respond(id, textResult(body.swarms));
      } else if (name === "skills_list") {
        const body = await api<{ skills: unknown[] }>("/api/skills");
        respond(id, textResult(body.skills));
      } else if (name === "workspaces_list") {
        const body = await api<{ workspaces: unknown[] }>("/api/workspaces");
        respond(id, textResult(body.workspaces));
      } else {
        respondError(id, `unknown tool: ${name}`);
      }
    } catch (err) {
      respondError(id, err instanceof Error ? err.message : String(err));
    }
    return;
  }
  if (method === "ping") {
    respond(id, {});
    return;
  }
  if (id !== undefined) respondError(id, `unsupported method: ${method}`);
}

const rl = createInterface({ input: process.stdin, crlfDelay: Infinity });
rl.on("line", (line) => {
  const trimmed = line.trim();
  if (!trimmed) return;
  try {
    void handle(JSON.parse(trimmed) as Json);
  } catch (err) {
    process.stderr.write(`agentgrid-mcp parse error: ${String(err)}\n`);
  }
});

process.stderr.write(
  `agentgrid-mcp ready — memory ${memoryDir} · API ${apiBase}\n`,
);
