import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { SkillSpec } from "@agentgrid/shared";

function bundledSkillsDir(): string {
  return join(dirname(fileURLToPath(import.meta.url)), "../../skills");
}

function parseSkill(raw: string, fallbackId: string): SkillSpec | null {
  const match = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) {
    return {
      id: fallbackId,
      name: fallbackId,
      description: "",
      prompt: raw.trim(),
    };
  }
  const front = match[1]!;
  const body = match[2]!.trim();
  const meta: Record<string, string> = {};
  for (const line of front.split("\n")) {
    const idx = line.indexOf(":");
    if (idx === -1) continue;
    meta[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
  }
  return {
    id: meta.id || fallbackId,
    name: meta.name || fallbackId,
    description: meta.description || "",
    prompt: body,
  };
}

export class SkillStore {
  private dir: string;

  constructor(dir = bundledSkillsDir()) {
    this.dir = dir;
  }

  list(): SkillSpec[] {
    if (!existsSync(this.dir)) return [];
    const skills: SkillSpec[] = [];
    for (const name of readdirSync(this.dir)) {
      if (!name.endsWith(".md")) continue;
      const raw = readFileSync(join(this.dir, name), "utf8");
      const skill = parseSkill(raw, name.replace(/\.md$/, ""));
      if (skill) skills.push(skill);
    }
    return skills.sort((a, b) => a.name.localeCompare(b.name));
  }

  get(id: string): SkillSpec | undefined {
    return this.list().find((s) => s.id === id);
  }
}
