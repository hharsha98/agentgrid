#!/usr/bin/env node
/**
 * Start server+web for Tauri only when ports are free.
 * (plain English: if you already ran `pnpm dev`, don't start a second copy.)
 */
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "../../..");

async function healthy(url) {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(800) });
    return res.ok;
  } catch {
    return false;
  }
}

if (await healthy("http://127.0.0.1:4318/api/health")) {
  console.log("[desktop] server already on :4318 — reusing");
} else {
  console.log("[desktop] starting monorepo dev (server + web)…");
  const child = spawn(
    "pnpm",
    ["-r", "--parallel", "--filter", "@agentgrid/server", "--filter", "@agentgrid/web", "run", "dev"],
    { cwd: root, stdio: "inherit", shell: true },
  );
  // Wait until health responds (or fail after ~30s)
  const deadline = Date.now() + 30000;
  while (Date.now() < deadline) {
    if (await healthy("http://127.0.0.1:4318/api/health")) break;
    await new Promise((r) => setTimeout(r, 400));
  }
  if (!(await healthy("http://127.0.0.1:4318/api/health"))) {
    child.kill();
    console.error("[desktop] server failed to become healthy");
    process.exit(1);
  }
  // Keep this process alive so Tauri's beforeDevCommand doesn't exit
  // (Tauri kills it when the window closes).
  await new Promise(() => {});
}
