import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import {
  isAgentId,
  type AgentId,
  type KanbanCard,
  type KanbanColumn,
  type UpsertKanbanCardRequest,
} from "@agentgrid/shared";

const COLUMNS: KanbanColumn[] = ["todo", "in_progress", "in_review", "done"];

function storePath(): string {
  const dir = join(homedir(), ".agentgrid");
  mkdirSync(dir, { recursive: true });
  return join(dir, "kanban.json");
}

function isColumn(value: unknown): value is KanbanColumn {
  return typeof value === "string" && (COLUMNS as string[]).includes(value);
}

function sanitize(raw: unknown): KanbanCard | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (typeof o.id !== "string" || typeof o.title !== "string") return null;
  if (!isColumn(o.column)) return null;
  if (typeof o.agentId !== "string" || !isAgentId(o.agentId)) return null;
  return {
    id: o.id,
    title: o.title.trim() || "untitled",
    body: typeof o.body === "string" ? o.body : undefined,
    column: o.column,
    agentId: o.agentId,
    sessionId: typeof o.sessionId === "string" ? o.sessionId : undefined,
    createdAt: typeof o.createdAt === "string" ? o.createdAt : new Date().toISOString(),
    updatedAt: typeof o.updatedAt === "string" ? o.updatedAt : new Date().toISOString(),
  };
}

export class KanbanStore {
  private path: string;

  constructor(path = storePath()) {
    this.path = path;
  }

  list(): KanbanCard[] {
    if (!existsSync(this.path)) return [];
    try {
      const parsed = JSON.parse(readFileSync(this.path, "utf8")) as unknown;
      if (!Array.isArray(parsed)) return [];
      return parsed
        .map(sanitize)
        .filter((c): c is KanbanCard => c !== null)
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    } catch {
      return [];
    }
  }

  get(id: string): KanbanCard | undefined {
    return this.list().find((c) => c.id === id);
  }

  upsert(input: UpsertKanbanCardRequest): KanbanCard {
    const title = input.title?.trim();
    if (!title) throw new Error("title is required");
    const agentId: AgentId = input.agentId && isAgentId(input.agentId) ? input.agentId : "claude";
    const column: KanbanColumn =
      input.column && isColumn(input.column) ? input.column : "todo";

    const all = this.list();
    const existing = input.id ? all.find((c) => c.id === input.id) : undefined;
    const now = new Date().toISOString();
    const next: KanbanCard = {
      id: existing?.id ?? randomUUID(),
      title,
      body: input.body?.trim() || existing?.body,
      column: input.column && isColumn(input.column) ? input.column : (existing?.column ?? column),
      agentId: input.agentId && isAgentId(input.agentId) ? input.agentId : (existing?.agentId ?? agentId),
      sessionId: existing?.sessionId,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };
    this.write([...all.filter((c) => c.id !== next.id), next]);
    return next;
  }

  update(
    id: string,
    patch: Partial<Pick<KanbanCard, "title" | "body" | "column" | "agentId" | "sessionId">>,
  ): KanbanCard | undefined {
    const all = this.list();
    const idx = all.findIndex((c) => c.id === id);
    if (idx < 0) return undefined;
    const cur = all[idx]!;
    const next: KanbanCard = {
      ...cur,
      ...patch,
      title: patch.title?.trim() || cur.title,
      updatedAt: new Date().toISOString(),
    };
    all[idx] = next;
    this.write(all);
    return next;
  }

  remove(id: string): boolean {
    const all = this.list();
    const next = all.filter((c) => c.id !== id);
    if (next.length === all.length) return false;
    this.write(next);
    return true;
  }

  private write(items: KanbanCard[]): void {
    const tmp = `${this.path}.${process.pid}.tmp`;
    writeFileSync(tmp, JSON.stringify(items, null, 2) + "\n", "utf8");
    renameSync(tmp, this.path);
  }
}

export const KANBAN_COLUMNS = COLUMNS;
