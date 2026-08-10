import Fastify from "fastify";
import websocket from "@fastify/websocket";
import {
  DEFAULT_SERVER_PORT,
  isAgentId,
  type ClientMessage,
  type CreateSessionRequest,
  type ServerMessage,
  type DispatchKanbanCardRequest,
  type UpsertKanbanCardRequest,
  type UpsertWorkspaceRequest,
} from "@agentgrid/shared";
import { detectAgents } from "./pty/agents.js";
import { AgentMissingError, SessionManager } from "./pty/session-manager.js";
import { WorkspaceStore } from "./workspaces/store.js";
import { KanbanStore } from "./kanban/store.js";

export async function buildApp(options?: {
  workspaceStore?: WorkspaceStore;
  kanbanStore?: KanbanStore;
}) {
  const app = Fastify({ logger: true });
  const sessions = new SessionManager();
  const workspaces = options?.workspaceStore ?? new WorkspaceStore();
  const kanban = options?.kanbanStore ?? new KanbanStore();

  await app.register(websocket);

  app.get("/api/health", async () => ({
    ok: true,
    service: "agentgrid",
    port: Number(process.env.PORT ?? DEFAULT_SERVER_PORT),
  }));

  app.get("/api/agents", async () => ({ agents: detectAgents() }));

  app.get("/api/sessions", async () => ({ sessions: sessions.list() }));

  app.post<{ Body: CreateSessionRequest }>("/api/sessions", async (req, reply) => {
    const body = req.body ?? ({} as CreateSessionRequest);
    if (!body.agentId || !isAgentId(body.agentId)) {
      return reply.code(400).send({ error: "agentId is required and must be a known agent" });
    }
    try {
      const session = sessions.create({
        agentId: body.agentId,
        cwd: body.cwd,
        cols: body.cols,
        rows: body.rows,
        title: body.title,
        initialInput: body.initialInput,
      });
      return reply.code(201).send({ session });
    } catch (err) {
      if (err instanceof AgentMissingError) {
        return reply.code(409).send({
          error: err.message,
          agentId: err.agentId,
          installHint: err.installHint,
        });
      }
      throw err;
    }
  });

  app.delete<{ Params: { id: string } }>("/api/sessions/:id", async (req, reply) => {
    const ok = sessions.dispose(req.params.id);
    if (!ok) return reply.code(404).send({ error: "session not found" });
    return reply.code(204).send();
  });

  app.get("/api/workspaces", async () => ({ workspaces: workspaces.list() }));

  app.post<{ Body: UpsertWorkspaceRequest }>("/api/workspaces", async (req, reply) => {
    try {
      const workspace = workspaces.upsert(req.body ?? ({} as UpsertWorkspaceRequest));
      return reply.code(201).send({ workspace });
    } catch (err) {
      return reply.code(400).send({
        error: err instanceof Error ? err.message : String(err),
      });
    }
  });

  app.delete<{ Params: { id: string } }>("/api/workspaces/:id", async (req, reply) => {
    const ok = workspaces.remove(req.params.id);
    if (!ok) return reply.code(404).send({ error: "workspace not found" });
    return reply.code(204).send();
  });

  app.post<{ Params: { id: string } }>("/api/workspaces/:id/launch", async (req, reply) => {
    const workspace = workspaces.get(req.params.id);
    if (!workspace) return reply.code(404).send({ error: "workspace not found" });

    const created = [];
    try {
      for (const pane of workspace.panes) {
        created.push(
          sessions.create({
            agentId: pane.agentId,
            cwd: workspace.cwd,
            title: pane.title ?? `${workspace.name} · ${pane.agentId}`,
          }),
        );
      }
    } catch (err) {
      for (const s of created) sessions.dispose(s.id);
      if (err instanceof AgentMissingError) {
        return reply.code(409).send({
          error: err.message,
          agentId: err.agentId,
          installHint: err.installHint,
        });
      }
      throw err;
    }

    return reply.code(201).send({ workspace, sessions: created });
  });


  app.get("/api/kanban", async () => ({ cards: kanban.list() }));

  app.post<{ Body: UpsertKanbanCardRequest }>("/api/kanban/cards", async (req, reply) => {
    try {
      const card = kanban.upsert(req.body ?? ({} as UpsertKanbanCardRequest));
      return reply.code(201).send({ card });
    } catch (err) {
      return reply.code(400).send({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  app.patch<{ Params: { id: string }; Body: UpsertKanbanCardRequest }>(
    "/api/kanban/cards/:id",
    async (req, reply) => {
      const body = req.body ?? {};
      const updated = kanban.update(req.params.id, {
        title: body.title,
        body: body.body,
        column: body.column,
        agentId: body.agentId,
      });
      if (!updated) return reply.code(404).send({ error: "card not found" });
      return { card: updated };
    },
  );

  app.delete<{ Params: { id: string } }>("/api/kanban/cards/:id", async (req, reply) => {
    const ok = kanban.remove(req.params.id);
    if (!ok) return reply.code(404).send({ error: "card not found" });
    return reply.code(204).send();
  });

  app.post<{ Params: { id: string }; Body: DispatchKanbanCardRequest }>(
    "/api/kanban/cards/:id/dispatch",
    async (req, reply) => {
      const card = kanban.get(req.params.id);
      if (!card) return reply.code(404).send({ error: "card not found" });
      const agentId = req.body?.agentId && isAgentId(req.body.agentId) ? req.body.agentId : card.agentId;
      const prompt = [card.title, card.body].filter(Boolean).join("\n\n");
      try {
        const session = sessions.create({
          agentId,
          cwd: req.body?.cwd,
          title: card.title,
          initialInput: agentId === "shell" ? prompt : prompt,
        });
        const updated = kanban.update(card.id, {
          column: "in_progress",
          sessionId: session.id,
          agentId,
        });
        return reply.code(201).send({ card: updated, session });
      } catch (err) {
        if (err instanceof AgentMissingError) {
          return reply.code(409).send({
            error: err.message,
            agentId: err.agentId,
            installHint: err.installHint,
          });
        }
        throw err;
      }
    },
  );

  app.get<{ Params: { id: string } }>("/api/sessions/:id/ws", { websocket: true }, (socket, req) => {
    const id = req.params.id;
    const info = sessions.get(id);
    if (!info) {
      const msg: ServerMessage = { type: "error", message: "session not found" };
      socket.send(JSON.stringify(msg));
      socket.close();
      return;
    }

    const send = (message: ServerMessage) => {
      if (socket.readyState === socket.OPEN) {
        socket.send(JSON.stringify(message));
      }
    };

    send({ type: "ready", session: info });

    const unsubscribe = sessions.subscribe(
      id,
      (data) => send({ type: "output", data }),
      (code) => send({ type: "exit", code }),
    );

    socket.on("message", (raw) => {
      let parsed: ClientMessage;
      try {
        parsed = JSON.parse(String(raw)) as ClientMessage;
      } catch {
        send({ type: "error", message: "invalid JSON message" });
        return;
      }

      if (parsed.type === "input") {
        sessions.write(id, parsed.data);
      } else if (parsed.type === "resize") {
        if (
          typeof parsed.cols === "number" &&
          typeof parsed.rows === "number" &&
          parsed.cols > 0 &&
          parsed.rows > 0
        ) {
          sessions.resize(id, parsed.cols, parsed.rows);
        }
      }
    });

    socket.on("close", () => {
      unsubscribe?.();
    });
  });

  app.addHook("onClose", async () => {
    sessions.disposeAll();
  });

  return { app, sessions, workspaces, kanban };
}

async function main() {
  const port = Number(process.env.PORT ?? DEFAULT_SERVER_PORT);
  const { app } = await buildApp();
  await app.listen({ port, host: "127.0.0.1" });
  app.log.info(`agentgrid server listening on http://127.0.0.1:${port}`);
}

const isDirect =
  process.argv[1] &&
  (process.argv[1].endsWith("index.ts") || process.argv[1].endsWith("index.js"));

if (isDirect) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
