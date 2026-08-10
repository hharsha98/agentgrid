import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  realpathSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { homedir } from "node:os";
import { basename, join, relative, resolve, sep } from "node:path";
import type { FsEntry, FsFileContent } from "@agentgrid/shared";

const MAX_READ_BYTES = 512 * 1024; // 512 KB soft limit for editor
const SKIP = new Set(["node_modules", ".git", "dist", "build", ".next", "coverage"]);

export class PathEscapeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PathEscapeError";
  }
}

export function defaultRoots(): string[] {
  const home = homedir();
  const projects = join(home, "Projects");
  const roots = [home];
  if (existsSync(projects)) roots.unshift(projects);
  return roots;
}

function real(path: string): string {
  return realpathSync.native(path);
}

/** Resolve user path under an allowed root; throw if it escapes. */
export function resolveUnderRoot(root: string, relPath = "."): string {
  if (!root || !existsSync(root)) throw new PathEscapeError("root does not exist");
  const rootReal = real(root);
  const candidate = resolve(rootReal, relPath || ".");
  let resolved: string;
  try {
    resolved = existsSync(candidate) ? real(candidate) : candidate;
  } catch {
    resolved = candidate;
  }
  const rel = relative(rootReal, resolved);
  if (rel.startsWith("..") || rel.includes(`..${sep}`)) {
    throw new PathEscapeError("path escapes root");
  }
  return resolved;
}

export function listDir(root: string, relPath = "."): FsEntry[] {
  const abs = resolveUnderRoot(root, relPath);
  const st = statSync(abs);
  if (!st.isDirectory()) throw new Error("not a directory");
  const entries: FsEntry[] = [];
  for (const name of readdirSync(abs)) {
    if (SKIP.has(name) || name === ".DS_Store") continue;
    const child = join(abs, name);
    let cst;
    try {
      cst = statSync(child);
    } catch {
      continue;
    }
    const rel = relative(resolveUnderRoot(root, "."), child).split(sep).join("/");
    entries.push({
      name,
      path: rel,
      type: cst.isDirectory() ? "dir" : "file",
      size: cst.isFile() ? cst.size : undefined,
    });
  }
  entries.sort((a, b) => {
    if (a.type !== b.type) return a.type === "dir" ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
  return entries;
}

export function readFile(root: string, relPath: string): FsFileContent {
  const abs = resolveUnderRoot(root, relPath);
  const st = statSync(abs);
  if (!st.isFile()) throw new Error("not a file");
  const truncated = st.size > MAX_READ_BYTES;
  const buf = readFileSync(abs);
  const slice = truncated ? buf.subarray(0, MAX_READ_BYTES) : buf;
  // Reject obvious binaries
  if (slice.includes(0)) throw new Error("binary file not supported in editor");
  return {
    path: relPath.split(sep).join("/"),
    content: slice.toString("utf8"),
    truncated,
  };
}

export function writeFile(root: string, relPath: string, content: string): FsFileContent {
  if (!relPath || relPath.endsWith("/") || relPath.endsWith(sep)) {
    throw new Error("file path required");
  }
  const abs = resolveUnderRoot(root, relPath);
  const parent = resolve(abs, "..");
  // parent must stay under root
  resolveUnderRoot(root, relative(resolveUnderRoot(root, "."), parent) || ".");
  mkdirSync(parent, { recursive: true });
  writeFileSync(abs, content, "utf8");
  return {
    path: relPath.split(sep).join("/"),
    content,
  };
}

export function ensureDir(path: string): void {
  mkdirSync(path, { recursive: true });
}

export { basename };


export function statFile(root: string, relPath: string): { path: string; mtimeMs: number; size: number } {
  const abs = resolveUnderRoot(root, relPath);
  const st = statSync(abs);
  if (!st.isFile()) throw new Error("not a file");
  return { path: relative(real(root), abs) || basename(abs), mtimeMs: st.mtimeMs, size: st.size };
}
