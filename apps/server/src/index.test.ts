import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildApp } from "./index.js";
import type { SessionManager } from "./pty/session-manager.js";
import { WorkspaceStore } from "./workspaces/store.js";
import { KanbanStore } from "./kanban/store.js";
import { MemoryStore } from "./memory/store.js";
import { SwarmStore } from "./swarm/store.js";
import { SkillStore } from "./skills/store.js";
import { PromptStore } from "./prompts/store.js";

describe("HTTP API", () => {
  let app: FastifyInstance;
  let sessions: SessionManager;
  let tmpDir: string;

  beforeAll(async () => {
    tmpDir = mkdtempSync(join(tmpdir(), "agentgrid-api-ws-"));
    const built = await buildApp({
      workspaceStore: new WorkspaceStore(join(tmpDir, "workspaces.json")),
      kanbanStore: new KanbanStore(join(tmpDir, "kanban.json")),
      memoryStore: new MemoryStore(join(tmpDir, "memory")),
      swarmStore: new SwarmStore(join(tmpDir, "swarms.json")),
      skillStore: new SkillStore(),
      promptStore: new PromptStore(join(tmpDir, "prompts.json")),
      fsRoots: [tmpDir],
    });
    app = built.app;
    sessions = built.sessions;
    await app.ready();
  });

  afterAll(async () => {
    sessions.disposeAll();
    await app.close();
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("health check", async () => {
    const res = await app.inject({ method: "GET", url: "/api/health" });
    expect(res.statusCode).toBe(200);
    const body = res.json() as { ok: boolean; service: string };
    expect(body.ok).toBe(true);
    expect(body.service).toBe("agentgrid");
  });

  it("lists agents", async () => {
    const res = await app.inject({ method: "GET", url: "/api/agents" });
    expect(res.statusCode).toBe(200);
    const body = res.json() as { agents: { id: string }[] };
    expect(body.agents.some((a) => a.id === "shell")).toBe(true);
  });

  it("creates and lists a shell session", async () => {
    const create = await app.inject({
      method: "POST",
      url: "/api/sessions",
      payload: { agentId: "shell", title: "test-shell" },
    });
    expect(create.statusCode).toBe(201);
    const created = create.json() as { session: { id: string; agentId: string } };
    expect(created.session.agentId).toBe("shell");

    const list = await app.inject({ method: "GET", url: "/api/sessions" });
    const listed = list.json() as { sessions: { id: string }[] };
    expect(listed.sessions.some((s) => s.id === created.session.id)).toBe(true);

    const del = await app.inject({
      method: "DELETE",
      url: `/api/sessions/${created.session.id}`,
    });
    expect(del.statusCode).toBe(204);
  });

  it("rejects unknown agent ids", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/sessions",
      payload: { agentId: "nope" },
    });
    expect(res.statusCode).toBe(400);
  });

  it("saves and launches a workspace template", async () => {
    const save = await app.inject({
      method: "POST",
      url: "/api/workspaces",
      payload: {
        name: "pair",
        layout: 2,
        panes: [{ agentId: "shell", title: "A" }, { agentId: "shell", title: "B" }],
      },
    });
    expect(save.statusCode).toBe(201);
    const saved = save.json() as { workspace: { id: string } };

    const list = await app.inject({ method: "GET", url: "/api/workspaces" });
    expect(list.statusCode).toBe(200);
    const listed = list.json() as { workspaces: { id: string }[] };
    expect(listed.workspaces.some((w) => w.id === saved.workspace.id)).toBe(true);

    const launch = await app.inject({
      method: "POST",
      url: `/api/workspaces/${saved.workspace.id}/launch`,
    });
    expect(launch.statusCode).toBe(201);
    const launched = launch.json() as { sessions: { id: string }[] };
    expect(launched.sessions).toHaveLength(2);
    for (const s of launched.sessions) {
      sessions.dispose(s.id);
    }
  });


  it("creates and dispatches a kanban card", async () => {
    const create = await app.inject({
      method: "POST",
      url: "/api/kanban/cards",
      payload: { title: "Run echo", agentId: "shell" },
    });
    expect(create.statusCode).toBe(201);
    const created = create.json() as { card: { id: string } };

    const dispatch = await app.inject({
      method: "POST",
      url: `/api/kanban/cards/${created.card.id}/dispatch`,
      payload: {},
    });
    expect(dispatch.statusCode).toBe(201);
    const body = dispatch.json() as {
      card: { column: string; sessionId?: string };
      session: { id: string };
    };
    expect(body.card.column).toBe("in_progress");
    expect(body.session.id).toBeTruthy();
    sessions.dispose(body.session.id);
  });

  it("defaults new kanban cards to the shell agent", async () => {
    const create = await app.inject({
      method: "POST",
      url: "/api/kanban/cards",
      payload: { title: "No agent specified" },
    });
    expect(create.statusCode).toBe(201);
    expect((create.json() as { card: { agentId: string } }).card.agentId).toBe("shell");
  });


  it("reads and writes files under allowed roots", async () => {
    const write = await app.inject({
      method: "PUT",
      url: "/api/fs/file",
      payload: { root: tmpDir, path: "hello.txt", content: "hi" },
    });
    expect(write.statusCode).toBe(200);
    const read = await app.inject({
      method: "GET",
      url: `/api/fs/file?root=${encodeURIComponent(tmpDir)}&path=hello.txt`,
    });
    expect(read.statusCode).toBe(200);
    expect((read.json() as { file: { content: string } }).file.content).toBe("hi");
  });

  it("creates shared memory notes", async () => {
    const create = await app.inject({
      method: "POST",
      url: "/api/memory",
      payload: { title: "Decisions", content: "# Decisions\n\nUse pnpm\n" },
    });
    expect(create.statusCode).toBe(201);
    const list = await app.inject({ method: "GET", url: "/api/memory" });
    const body = list.json() as { notes: { title: string }[] };
    expect(body.notes.some((n) => n.title === "Decisions")).toBe(true);
  });


  it("lists bundled skills", async () => {
    const res = await app.inject({ method: "GET", url: "/api/skills" });
    expect(res.statusCode).toBe(200);
    const body = res.json() as { skills: { id: string }[] };
    expect(body.skills.some((s) => s.id === "security-review")).toBe(true);
  });


  it("saves and applies prompts", async () => {
    const create = await app.inject({
      method: "POST",
      url: "/api/prompts",
      payload: { name: "Hello", body: "echo hi" },
    });
    expect(create.statusCode).toBe(201);
    const created = create.json() as { prompt: { id: string } };

    const session = await app.inject({
      method: "POST",
      url: "/api/sessions",
      payload: { agentId: "shell", title: "prompt-target" },
    });
    const sid = (session.json() as { session: { id: string } }).session.id;

    const apply = await app.inject({
      method: "POST",
      url: `/api/prompts/${created.prompt.id}/apply`,
      payload: { sessionId: sid },
    });
    expect(apply.statusCode).toBe(200);
    sessions.dispose(sid);
  });

  it("stats files", async () => {
    await app.inject({
      method: "PUT",
      url: "/api/fs/file",
      payload: { root: tmpDir, path: "stat-me.txt", content: "abc" },
    });
    const res = await app.inject({
      method: "GET",
      url: `/api/fs/stat?root=${encodeURIComponent(tmpDir)}&path=stat-me.txt`,
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as { stat: { size: number; mtimeMs: number } };
    expect(body.stat.size).toBe(3);
    expect(body.stat.mtimeMs).toBeGreaterThan(0);
  });

  it("moves kanban card when linked session exits", async () => {
    const create = await app.inject({
      method: "POST",
      url: "/api/kanban/cards",
      payload: { title: "Exit sync", agentId: "shell" },
    });
    const cardId = (create.json() as { card: { id: string } }).card.id;
    const dispatch = await app.inject({
      method: "POST",
      url: `/api/kanban/cards/${cardId}/dispatch`,
      payload: {},
    });
    expect(dispatch.statusCode).toBe(201);
    const body = dispatch.json() as {
      card: { sessionId?: string };
      session: { id: string };
    };
    const sessionId = body.session.id;
    sessions.write(sessionId, "exit\n");
    // Wait for pty exit + handler
    let column = "in_progress";
    for (let i = 0; i < 40; i++) {
      await new Promise((r) => setTimeout(r, 100));
      const list = await app.inject({ method: "GET", url: "/api/kanban" });
      const cards = (list.json() as { cards: { id: string; column: string }[] }).cards;
      const card = cards.find((c) => c.id === cardId);
      if (card && card.column !== "in_progress") {
        column = card.column;
        break;
      }
    }
    expect(["done", "in_review"]).toContain(column);
    sessions.dispose(sessionId);
  });

  it("launches a swarm with fallbacks", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/swarm",
      payload: {
        name: "Demo",
        mission: "Explore and report",
        roles: {
          coordinator: "shell",
          builder: "shell",
          scout: "shell",
          reviewer: "shell",
        },
      },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json() as {
      swarm: { members: { role: string; sessionId?: string }[] };
      sessions: { id: string }[];
    };
    expect(body.swarm.members).toHaveLength(4);
    expect(body.sessions).toHaveLength(4);
    for (const s of body.sessions) sessions.dispose(s.id);
  });

  it("exposes settings without claiming a studio Live URL", async () => {
    const res = await app.inject({ method: "GET", url: "/api/settings" });
    expect(res.statusCode).toBe(200);
    const body = res.json() as {
      studio: { live: boolean; publicUrl: string | null };
      fsRoots: string[];
      mcp: { framing: string[] };
    };
    expect(body.studio.live).toBe(false);
    expect(body.studio.publicUrl).toBeNull();
    expect(body.fsRoots.length).toBeGreaterThan(0);
    expect(body.mcp.framing).toContain("content-length");
  });

  it("rejects a missing working directory", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/sessions",
      payload: { agentId: "shell", cwd: join(tmpDir, "no-such-dir") },
    });
    expect(res.statusCode).toBe(400);
    expect((res.json() as { error: string }).error).toMatch(/Working directory/);
  });

  it("marks a session exited after the process ends", async () => {
    const create = await app.inject({
      method: "POST",
      url: "/api/sessions",
      payload: { agentId: "shell", title: "exit-soon" },
    });
    const sid = (create.json() as { session: { id: string; status?: string } }).session.id;
    sessions.write(sid, "exit\n");
    let status = "running";
    for (let i = 0; i < 40; i++) {
      await new Promise((r) => setTimeout(r, 100));
      const info = sessions.get(sid);
      if (info?.status === "exited") {
        status = "exited";
        break;
      }
    }
    expect(status).toBe("exited");
    expect(sessions.write(sid, "echo still?\n")).toBe(false);
    const apply = await app.inject({
      method: "POST",
      url: "/api/skills/security-review/apply",
      payload: { sessionId: sid },
    });
    expect(apply.statusCode).toBe(409);
    sessions.dispose(sid);
  });

  it("applies a skill into a live shell session", async () => {
    const session = await app.inject({
      method: "POST",
      url: "/api/sessions",
      payload: { agentId: "shell", title: "skill-target" },
    });
    const sid = (session.json() as { session: { id: string } }).session.id;
    const apply = await app.inject({
      method: "POST",
      url: "/api/skills/security-review/apply",
      payload: { sessionId: sid },
    });
    expect(apply.statusCode).toBe(200);
    sessions.dispose(sid);
  });

  it("streams PTY bytes over the session websocket", async () => {
    const create = await app.inject({
      method: "POST",
      url: "/api/sessions",
      payload: { agentId: "shell", title: "ws-shell" },
    });
    const sid = (create.json() as { session: { id: string } }).session.id;

    await app.listen({ port: 0, host: "127.0.0.1" });
    const addr = app.server.address();
    const port = typeof addr === "object" && addr ? addr.port : 0;

    const ws = new WebSocket(`ws://127.0.0.1:${port}/api/sessions/${sid}/ws`);
    const got: Array<{ type: string; data?: string }> = [];
    try {
      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error("websocket timeout")), 12000);
        ws.addEventListener("message", (ev) => {
          const msg = JSON.parse(String(ev.data)) as { type: string; data?: string };
          got.push(msg);
          if (msg.type === "ready") {
            ws.send(JSON.stringify({ type: "input", data: "printf 'agentgrid-ws-ok\\n'\n" }));
          }
          if (msg.type === "output" && (msg.data ?? "").includes("agentgrid-ws-ok")) {
            clearTimeout(timer);
            resolve();
          }
        });
        ws.addEventListener("error", () => {
          clearTimeout(timer);
          reject(new Error("websocket error"));
        });
      });
    } finally {
      ws.close();
      sessions.dispose(sid);
    }
    expect(got.some((m) => m.type === "ready")).toBe(true);
  }, 15000);

  it("posts swarm mail and updates plan nodes", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/swarm",
      payload: {
        name: "Mail",
        mission: "Talk",
        roles: {
          coordinator: "shell",
          builder: "shell",
          scout: "shell",
          reviewer: "shell",
        },
      },
    });
    const created = res.json() as {
      swarm: { id: string; plan: { id: string }[]; members: { sessionId?: string }[] };
      sessions: { id: string }[];
    };
    const mail = await app.inject({
      method: "POST",
      url: `/api/swarm/${created.swarm.id}/mail`,
      payload: { fromRole: "human", body: "hello team" },
    });
    expect(mail.statusCode).toBe(200);
    expect(
      (mail.json() as { swarm: { mailbox: { body: string }[] } }).swarm.mailbox[0]?.body,
    ).toBe("hello team");
    const nodeId = created.swarm.plan[0]!.id;
    const plan = await app.inject({
      method: "POST",
      url: `/api/swarm/${created.swarm.id}/plan`,
      payload: { nodeId, status: "doing" },
    });
    expect(plan.statusCode).toBe(200);
    for (const s of created.sessions) sessions.dispose(s.id);
  });

});
