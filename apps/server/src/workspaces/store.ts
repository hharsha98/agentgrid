import { mkdirSync, readFileSync, renameSync, writeFileSync, existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import {
  isAgentId,
  type LayoutPreset,
  type UpsertWorkspaceRequest,
  type WorkspaceTemplate,
} from "@agentgrid/shared";

function storePath(): string {
  const dir = join(homedir(), ".agentgrid");
  mkdirSync(dir, { recursive: true });
  return join(dir, "workspaces.json");
}

function isLayout(value: unknown): value is LayoutPreset {
  return value === 1 || value === 2 || value === 4 || value === 6 || value === 8 || value === 10 || value === 12 || value === 14 || value === 16;
}

function sanitize(raw: unknown): WorkspaceTemplate | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;
  if (typeof obj.id !== "string" || typeof obj.name !== "string") return null;
  if (!isLayout(obj.layout)) return null;
  if (!Array.isArray(obj.panes)) return null;
  const panes = [];
  for (const pane of obj.panes) {
    if (!pane || typeof pane !== "object") return null;
    const p = pane as Record<string, unknown>;
    if (typeof p.agentId !== "string" || !isAgentId(p.agentId)) return null;
    panes.push({
      agentId: p.agentId,
      title: typeof p.title === "string" ? p.title : undefined,
    });
  }
  return {
    id: obj.id,
    name: obj.name.trim() || "untitled",
    cwd: typeof obj.cwd === "string" && obj.cwd.length > 0 ? obj.cwd : undefined,
    layout: obj.layout,
    panes,
    updatedAt: typeof obj.updatedAt === "string" ? obj.updatedAt : new Date().toISOString(),
  };
}

export class WorkspaceStore {
  private path: string;

  constructor(path = storePath()) {
    this.path = path;
  }

  list(): WorkspaceTemplate[] {
    if (!existsSync(this.path)) return [];
    try {
      const parsed = JSON.parse(readFileSync(this.path, "utf8")) as unknown;
      if (!Array.isArray(parsed)) return [];
      return parsed
        .map(sanitize)
        .filter((w): w is WorkspaceTemplate => w !== null)
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    } catch {
      return [];
    }
  }

  get(id: string): WorkspaceTemplate | undefined {
    return this.list().find((w) => w.id === id);
  }

  upsert(input: UpsertWorkspaceRequest): WorkspaceTemplate {
    const name = input.name.trim();
    if (!name) throw new Error("name is required");
    if (!isLayout(input.layout)) throw new Error("layout must be 1, 2, 4, 6, 8, 12, or 16");
    if (!Array.isArray(input.panes) || input.panes.length === 0) {
      throw new Error("at least one pane is required");
    }
    for (const pane of input.panes) {
      if (!isAgentId(pane.agentId)) throw new Error(`unknown agent: ${String(pane.agentId)}`);
    }

    const all = this.list();
    const id = input.id && all.some((w) => w.id === input.id) ? input.id : randomUUID();
    const next: WorkspaceTemplate = {
      id,
      name,
      cwd: input.cwd?.trim() || undefined,
      layout: input.layout,
      panes: input.panes.map((p) => ({
        agentId: p.agentId,
        title: p.title?.trim() || undefined,
      })),
      updatedAt: new Date().toISOString(),
    };

    const others = all.filter((w) => w.id !== id);
    this.write([...others, next]);
    return next;
  }

  remove(id: string): boolean {
    const all = this.list();
    const next = all.filter((w) => w.id !== id);
    if (next.length === all.length) return false;
    this.write(next);
    return true;
  }

  private write(items: WorkspaceTemplate[]): void {
    const tmp = `${this.path}.${process.pid}.tmp`;
    writeFileSync(tmp, JSON.stringify(items, null, 2) + "\n", "utf8");
    renameSync(tmp, this.path);
  }
}
