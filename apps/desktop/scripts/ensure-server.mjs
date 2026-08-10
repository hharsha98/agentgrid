#!/usr/bin/env node
/**
 * Keep the Fastify API (:4318) alive for the Tauri window.
 * If the server is already running, wait quietly until we are killed.
 * If not, start `pnpm --filter @agentgrid/server start` from the monorepo root.
 */
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));

function resolveRoot() {
  if (process.env.AGENTGRID_ROOT && existsSync(join(process.env.AGENTGRID_ROOT, "pnpm-workspace.yaml"))) {
    return process.env.AGENTGRID_ROOT;
  }
  // scripts/ → desktop/ → apps/ → repo root
  const candidate = join(here, "../../..");
  if (existsSync(join(candidate, "pnpm-workspace.yaml"))) return candidate;
  // bundled resource next to copied script variants
  for (const rel of ["../../../..", "../../", ".."]) {
    const p = join(here, rel);
    if (existsSync(join(p, "pnpm-workspace.yaml"))) return p;
  }
  throw new Error("Could not find agentgrid monorepo root (set AGENTGRID_ROOT)");
}

async function healthy() {
  try {
    const res = await fetch("http://127.0.0.1:4318/api/health", {
      signal: AbortSignal.timeout(800),
    });
    return res.ok;
  } catch {
    return false;
  }
}

const root = resolveRoot();
let child = null;
let startedByUs = false;

if (await healthy()) {
  console.log("[ensure-server] already healthy on :4318 — watching");
} else {
  console.log("[ensure-server] starting @agentgrid/server from", root);
  child = spawn(
    "pnpm",
    ["--filter", "@agentgrid/server", "start"],
    { cwd: root, stdio: "inherit", shell: true },
  );
  startedByUs = true;
  const deadline = Date.now() + 30000;
  while (Date.now() < deadline) {
    if (await healthy()) break;
    await new Promise((r) => setTimeout(r, 400));
  }
  if (!(await healthy())) {
    child.kill();
    console.error("[ensure-server] server failed to become healthy");
    process.exit(1);
  }
  console.log("[ensure-server] server online");
}

function shutdown() {
  if (startedByUs && child) {
    console.log("[ensure-server] stopping server we started");
    child.kill();
  }
  process.exit(0);
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

await new Promise(() => {});
