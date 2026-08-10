#!/usr/bin/env node
/**
 * node-pty ships a native spawn-helper binary. After install the executable
 * bit is sometimes missing — this restores it so PTY sessions can start.
 */
import { chmodSync, existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(fileURLToPath(new URL("..", import.meta.url)));

function walk(dir) {
  if (!existsSync(dir)) return;
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return;
  }
  for (const name of entries) {
    const path = join(dir, name);
    let st;
    try {
      st = statSync(path);
    } catch {
      continue;
    }
    if (st.isDirectory()) {
      if (name === ".git") continue;
      walk(path);
      continue;
    }
    if (name === "spawn-helper") {
      try {
        chmodSync(path, 0o755);
        console.log(`[agentgrid] fixed permissions: ${path}`);
      } catch (err) {
        console.warn(`[agentgrid] could not chmod ${path}:`, err);
      }
    }
  }
}

walk(join(root, "node_modules"));
walk(join(root, "apps"));
