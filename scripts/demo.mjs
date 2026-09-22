#!/usr/bin/env node
/**
 * Start the local grid with DEMO_PUBLIC=1.
 * Missing Claude / Cursor / Codex / Gemini binaries become in-pane simulators.
 * Real binaries on PATH are still used. The API stays on 127.0.0.1.
 */
import { spawn } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const child = spawn(
  "pnpm",
  ["-r", "--parallel", "--filter", "@agentgrid/server", "--filter", "@agentgrid/web", "run", "dev"],
  {
    cwd: root,
    stdio: "inherit",
    env: { ...process.env, DEMO_PUBLIC: "1" },
  },
);

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => child.kill(signal));
}

child.on("exit", (code, signal) => {
  if (signal) process.exit(1);
  process.exit(code ?? 0);
});
