#!/usr/bin/env node
/**
 * STDIO MCP server for agentgrid.
 *
 * Local tools talk to ~/.agentgrid (memory).
 * Live tools call the Fastify API on 127.0.0.1:4318 when the server is up.
 *
 * Framing: LSP Content-Length (Cursor / Claude Desktop) and newline-delimited
 * JSON (simple clients / tests). The first complete message selects the mode.
 *
 * Configure Cursor MCP:
 *   command: pnpm
 *   args: ["--filter", "@agentgrid/mcp", "start"]
 *   cwd: /path/to/agentgrid
 */
import { mkdirSync } from "node:fs";
import { RpcFramer } from "./framing.js";
import {
  defaultApiBase,
  defaultMemoryDir,
  encodeResponse,
  handleRpc,
} from "./handlers.js";

const memoryDir = defaultMemoryDir();
mkdirSync(memoryDir, { recursive: true });
const apiBase = defaultApiBase();
const framer = new RpcFramer();

async function dispatch(raw: ReturnType<RpcFramer["push"]>[number]) {
  const resp = await handleRpc(raw, { memoryDir, apiBase });
  const encoded = encodeResponse(resp);
  if (encoded) process.stdout.write(framer.encode(encoded));
}

process.stdin.resume();
process.stdin.on("data", (chunk: Buffer) => {
  let messages;
  try {
    messages = framer.push(chunk);
  } catch (err) {
    process.stderr.write(`agentgrid-mcp parse error: ${String(err)}\n`);
    return;
  }
  for (const msg of messages) {
    void dispatch(msg).catch((err) => {
      process.stderr.write(`agentgrid-mcp handler error: ${String(err)}\n`);
    });
  }
});

process.stderr.write(`agentgrid-mcp ready — memory ${memoryDir} · API ${apiBase}\n`);
