#!/usr/bin/env node
/**
 * Minimal STDIO MCP-like JSON-RPC server for agentgrid shared memory.
 * Tools: memory_list, memory_read, memory_write
 *
 * Configure Claude Code / Cursor with something like:
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
  writeFileSync,
} from "node:fs";

const memoryDir = join(homedir(), ".agentgrid", "memory");
mkdirSync(memoryDir, { recursive: true });

type Json = Record<string, unknown>;

function respond(id: unknown, result: unknown) {
  const msg = { jsonrpc: "2.0", id, result };
  process.stdout.write(JSON.stringify(msg) + "\n");
}

function respondError(id: unknown, message: string) {
  const msg = {
    jsonrpc: "2.0",
    id,
    error: { code: -32000, message },
  };
  process.stdout.write(JSON.stringify(msg) + "\n");
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

const tools = [
  {
    name: "memory_list",
    description: "List shared agentgrid memory notes",
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
      properties: {
        id: { type: "string" },
        content: { type: "string" },
      },
      required: ["id", "content"],
    },
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
      serverInfo: { name: "agentgrid-memory", version: "0.1.0" },
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
        respond(id, {
          content: [{ type: "text", text: JSON.stringify(listNotes(), null, 2) }],
        });
      } else if (name === "memory_read") {
        const note = readNote(String(args.id ?? ""));
        respond(id, {
          content: [{ type: "text", text: note.content }],
        });
      } else if (name === "memory_write") {
        const saved = writeNote(String(args.id ?? ""), String(args.content ?? ""));
        respond(id, {
          content: [{ type: "text", text: `wrote ${saved.path}` }],
        });
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
  // Ignore unknowns with empty result when no id
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
  `agentgrid-mcp ready — memory dir ${memoryDir}\n`,
);
