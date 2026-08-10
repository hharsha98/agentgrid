import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildApp } from "./index.js";
import type { SessionManager } from "./pty/session-manager.js";
import { WorkspaceStore } from "./workspaces/store.js";
import { KanbanStore } from "./kanban/store.js";

describe("HTTP API", () => {
  let app: FastifyInstance;
  let sessions: SessionManager;
  let tmpDir: string;

  beforeAll(async () => {
    tmpDir = mkdtempSync(join(tmpdir(), "agentgrid-api-ws-"));
    const built = await buildApp({
      workspaceStore: new WorkspaceStore(join(tmpDir, "workspaces.json")),
      kanbanStore: new KanbanStore(join(tmpDir, "kanban.json")),
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

});
