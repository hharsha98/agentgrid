import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import type { PromptSpec, UpsertPromptRequest } from "@agentgrid/shared";

function storePath(): string {
  const dir = join(homedir(), ".agentgrid");
  mkdirSync(dir, { recursive: true });
  return join(dir, "prompts.json");
}

function sanitize(raw: unknown): PromptSpec | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (typeof o.id !== "string" || typeof o.name !== "string" || typeof o.body !== "string") {
    return null;
  }
  return {
    id: o.id,
    name: o.name.trim() || "untitled",
    body: o.body,
    updatedAt: typeof o.updatedAt === "string" ? o.updatedAt : new Date().toISOString(),
  };
}

export class PromptStore {
  private path: string;

  constructor(path = storePath()) {
    this.path = path;
  }

  list(): PromptSpec[] {
    if (!existsSync(this.path)) return [];
    try {
      const parsed = JSON.parse(readFileSync(this.path, "utf8")) as unknown;
      if (!Array.isArray(parsed)) return [];
      return parsed
        .map(sanitize)
        .filter((p): p is PromptSpec => p !== null)
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    } catch {
      return [];
    }
  }

  get(id: string): PromptSpec | undefined {
    return this.list().find((p) => p.id === id);
  }

  upsert(input: UpsertPromptRequest): PromptSpec {
    const name = (input.name ?? "").trim();
    const body = input.body ?? "";
    if (!name) throw new Error("name required");
    if (!body.trim()) throw new Error("body required");
    const all = this.list();
    const existing = input.id ? all.find((p) => p.id === input.id) : undefined;
    const now = new Date().toISOString();
    const next: PromptSpec = {
      id: existing?.id ?? randomUUID(),
      name,
      body,
      updatedAt: now,
    };
    this.write([next, ...all.filter((p) => p.id !== next.id)]);
    return next;
  }

  remove(id: string): boolean {
    const all = this.list();
    const next = all.filter((p) => p.id !== id);
    if (next.length === all.length) return false;
    this.write(next);
    return true;
  }

  private write(items: PromptSpec[]): void {
    const tmp = `${this.path}.${process.pid}.tmp`;
    writeFileSync(tmp, JSON.stringify(items, null, 2) + "\n", "utf8");
    renameSync(tmp, this.path);
  }
}
