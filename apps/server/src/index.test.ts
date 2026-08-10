import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "./index.js";
import type { SessionManager } from "./pty/session-manager.js";

describe("HTTP API", () => {
  let app: FastifyInstance;
  let sessions: SessionManager;

  beforeAll(async () => {
    const built = await buildApp();
    app = built.app;
    sessions = built.sessions;
    await app.ready();
  });

  afterAll(async () => {
    sessions.disposeAll();
    await app.close();
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
});
