import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import {
  isAgentId,
  type AgentId,
  type ClaimFileRequest,
  type CreateSwarmRequest,
  type FileOwnership,
  type PostSwarmMailRequest,
  type SwarmMailMessage,
  type SwarmMember,
  type SwarmMission,
  type SwarmPlanNode,
  type SwarmRole,
} from "@agentgrid/shared";

const ROLES: SwarmRole[] = ["coordinator", "builder", "scout", "reviewer"];

function storePath(): string {
  const dir = join(homedir(), ".agentgrid");
  mkdirSync(dir, { recursive: true });
  return join(dir, "swarms.json");
}

function defaultAgentForRole(role: SwarmRole): AgentId {
  if (role === "scout") return "cursor-agent";
  if (role === "reviewer") return "codex";
  return "claude";
}

export function rolePrompt(role: SwarmRole, mission: string, name: string): string {
  const common = `Swarm mission "${name}":\n${mission}\n\n`;
  switch (role) {
    case "coordinator":
      return (
        common +
        "You are the COORDINATOR. Break the mission into tasks, assign priorities, " +
        "and keep track of progress. Do not implement large features yourself — direct builders."
      );
    case "builder":
      return (
        common +
        "You are the BUILDER. Implement the highest-priority tasks. Claim files before editing " +
        "when possible. Prefer small, reviewable changes."
      );
    case "scout":
      return (
        common +
        "You are the SCOUT. Explore the codebase, gather facts, and report findings. " +
        "Avoid editing application code unless asked."
      );
    case "reviewer":
      return (
        common +
        "You are the REVIEWER. Review changes for correctness, security, and clarity. " +
        "Request fixes; do not silently rewrite large areas."
      );
  }
}

function sanitize(raw: unknown): SwarmMission | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (typeof o.id !== "string" || typeof o.name !== "string" || typeof o.mission !== "string") {
    return null;
  }
  if (o.status !== "running" && o.status !== "done" && o.status !== "failed") return null;
  if (!Array.isArray(o.members) || !Array.isArray(o.ownership)) return null;
  const mailbox = Array.isArray(o.mailbox) ? (o.mailbox as SwarmMailMessage[]) : [];
  const plan = Array.isArray(o.plan) ? (o.plan as SwarmPlanNode[]) : [];
  return {
    id: o.id,
    name: o.name,
    mission: o.mission,
    cwd: typeof o.cwd === "string" ? o.cwd : undefined,
    status: o.status,
    members: o.members as SwarmMember[],
    ownership: o.ownership as FileOwnership[],
    mailbox,
    plan,
    createdAt: typeof o.createdAt === "string" ? o.createdAt : new Date().toISOString(),
    updatedAt: typeof o.updatedAt === "string" ? o.updatedAt : new Date().toISOString(),
  };
}

export class SwarmStore {
  private path: string;

  constructor(path = storePath()) {
    this.path = path;
  }

  list(): SwarmMission[] {
    if (!existsSync(this.path)) return [];
    try {
      const parsed = JSON.parse(readFileSync(this.path, "utf8")) as unknown;
      if (!Array.isArray(parsed)) return [];
      return parsed
        .map(sanitize)
        .filter((s): s is SwarmMission => s !== null)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    } catch {
      return [];
    }
  }

  get(id: string): SwarmMission | undefined {
    return this.list().find((s) => s.id === id);
  }

  createDraft(input: CreateSwarmRequest): SwarmMission {
    const name = (input?.name ?? "").trim();
    const mission = (input?.mission ?? "").trim();
    if (!name || !mission) throw new Error("name and mission are required");

    const members: SwarmMember[] = ROLES.map((role) => {
      const override = input.roles?.[role];
      const agentId =
        override && isAgentId(override) ? override : defaultAgentForRole(role);
      return {
        role,
        agentId,
        title: `${name} · ${role}`,
      };
    });

    const now = new Date().toISOString();
    return {
      id: randomUUID(),
      name,
      mission,
      cwd: input.cwd?.trim() || undefined,
      status: "running",
      members,
      ownership: [],
      mailbox: [],
      plan: ROLES.map((role) => ({
        id: randomUUID(),
        title: `${role}: contribute to mission`,
        role,
        status: "pending" as const,
      })),
      createdAt: now,
      updatedAt: now,
    };
  }

  save(mission: SwarmMission): SwarmMission {
    const all = this.list().filter((s) => s.id !== mission.id);
    const next = { ...mission, updatedAt: new Date().toISOString() };
    this.write([next, ...all]);
    return next;
  }

  attachSessions(
    id: string,
    sessionByRole: Partial<Record<SwarmRole, string>>,
  ): SwarmMission | undefined {
    const mission = this.get(id);
    if (!mission) return undefined;
    const members = mission.members.map((m) => ({
      ...m,
      sessionId: sessionByRole[m.role] ?? m.sessionId,
    }));
    return this.save({ ...mission, members });
  }

  claim(id: string, input: ClaimFileRequest): SwarmMission {
    const mission = this.get(id);
    if (!mission) throw new Error("swarm not found");
    const path = input.path.trim();
    if (!path) throw new Error("path required");
    if (!ROLES.includes(input.role)) throw new Error("invalid role");

    const existing = mission.ownership.find((o) => o.path === path);
    if (existing && existing.sessionId !== input.sessionId) {
      throw new Error(
        `file already owned by ${existing.role} (${existing.sessionId.slice(0, 8)})`,
      );
    }

    const ownership: FileOwnership[] = [
      ...mission.ownership.filter((o) => o.path !== path),
      {
        path,
        role: input.role,
        sessionId: input.sessionId,
        claimedAt: new Date().toISOString(),
      },
    ];
    return this.save({ ...mission, ownership });
  }

  setStatus(id: string, status: SwarmMission["status"]): SwarmMission | undefined {
    const mission = this.get(id);
    if (!mission) return undefined;
    return this.save({ ...mission, status });
  }

  setPlanNodeStatus(
    id: string,
    nodeId: string,
    status: SwarmPlanNode["status"],
  ): SwarmMission {
    const mission = this.get(id);
    if (!mission) throw new Error("swarm not found");
    const walk = (nodes: SwarmPlanNode[]): SwarmPlanNode[] =>
      nodes.map((n) =>
        n.id === nodeId
          ? { ...n, status }
          : { ...n, children: n.children ? walk(n.children) : undefined },
      );
    return this.save({ ...mission, plan: walk(mission.plan ?? []) });
  }

  postMail(id: string, input: PostSwarmMailRequest): SwarmMission {
    const mission = this.get(id);
    if (!mission) throw new Error("swarm not found");
    const body = (input.body ?? "").trim();
    if (!body) throw new Error("body required");
    const fromRole = input.fromRole ?? "human";
    const msg: SwarmMailMessage = {
      id: randomUUID(),
      fromRole,
      body,
      createdAt: new Date().toISOString(),
    };
    return this.save({ ...mission, mailbox: [...(mission.mailbox ?? []), msg] });
  }

  private write(items: SwarmMission[]): void {
    const tmp = `${this.path}.${process.pid}.tmp`;
    writeFileSync(tmp, JSON.stringify(items, null, 2) + "\n", "utf8");
    renameSync(tmp, this.path);
  }
}

export { ROLES };
