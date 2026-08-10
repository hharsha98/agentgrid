import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import type { MemoryNote } from "@agentgrid/shared";

function memoryDir(): string {
  const dir = join(homedir(), ".agentgrid", "memory");
  mkdirSync(dir, { recursive: true });
  return dir;
}

function slugify(title: string): string {
  return (
    title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 60) || "note"
  );
}

export class MemoryStore {
  private dir: string;

  constructor(dir = memoryDir()) {
    this.dir = dir;
    mkdirSync(this.dir, { recursive: true });
  }

  list(): MemoryNote[] {
    if (!existsSync(this.dir)) return [];
    const notes: MemoryNote[] = [];
    for (const name of readdirSync(this.dir)) {
      if (!name.endsWith(".md")) continue;
      const id = name.slice(0, -3);
      const abs = join(this.dir, name);
      const content = readFileSync(abs, "utf8");
      const title = content.startsWith("# ")
        ? content.split("\n")[0]!.replace(/^#\s+/, "").trim()
        : id;
      const st = statSync(abs);
      notes.push({
        id,
        title,
        content,
        updatedAt: st.mtime.toISOString(),
      });
    }
    return notes.sort((a, b) => a.title.localeCompare(b.title));
  }

  get(id: string): MemoryNote | undefined {
    const safe = id.replace(/[^a-zA-Z0-9_-]/g, "");
    const abs = join(this.dir, `${safe}.md`);
    if (!existsSync(abs)) return undefined;
    const content = readFileSync(abs, "utf8");
    const title = content.startsWith("# ")
      ? content.split("\n")[0]!.replace(/^#\s+/, "").trim()
      : safe;
    return {
      id: safe,
      title,
      content,
      updatedAt: statSync(abs).mtime.toISOString(),
    };
  }

  upsert(input: { id?: string; title: string; content?: string }): MemoryNote {
    const title = input.title.trim();
    if (!title) throw new Error("title is required");
    const id = (input.id ?? slugify(title)).replace(/[^a-zA-Z0-9_-]/g, "");
    if (!id) throw new Error("invalid id");
    const body = input.content?.length
      ? input.content
      : `# ${title}\n\n`;
    const content = body.startsWith("# ") ? body : `# ${title}\n\n${body}`;
    const abs = join(this.dir, `${id}.md`);
    const tmp = `${abs}.${process.pid}.tmp`;
    writeFileSync(tmp, content, "utf8");
    renameSync(tmp, abs);
    return { id, title, content, updatedAt: new Date().toISOString() };
  }

  remove(id: string): boolean {
    const safe = id.replace(/[^a-zA-Z0-9_-]/g, "");
    const abs = join(this.dir, `${safe}.md`);
    if (!existsSync(abs)) return false;
    unlinkSync(abs);
    return true;
  }

  get directory(): string {
    return this.dir;
  }
}
