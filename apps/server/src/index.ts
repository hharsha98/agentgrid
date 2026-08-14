import Fastify from "fastify";
import cors from "@fastify/cors";
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
  type ApplySkillRequest,
  type ClaimFileRequest,
  type CreateSwarmRequest,
  type PostSwarmMailRequest,
  type UpsertPromptRequest,
  type ApplyPromptRequest,
} from "@agentgrid/shared";
import { detectAgents } from "./pty/agents.js";
import { AgentMissingError, SessionManager } from "./pty/session-manager.js";
import { WorkspaceStore } from "./workspaces/store.js";
import { KanbanStore } from "./kanban/store.js";
import {
  defaultRoots,
  listDir,
  PathEscapeError,
  readFile as readFsFile,
  writeFile as writeFsFile,
  statFile as statFsFile,
  searchFiles as searchFsFiles,
} from "./fs/safe-fs.js";
import { MemoryStore, resolveMemoryDir } from "./memory/store.js";
import { rolePrompt, SwarmStore } from "./swarm/store.js";
import { SkillStore } from "./skills/store.js";
import { PromptStore } from "./prompts/store.js";

export async function buildApp(options?: {
  workspaceStore?: WorkspaceStore;
  kanbanStore?: KanbanStore;
  memoryStore?: MemoryStore;
  swarmStore?: SwarmStore;
  skillStore?: SkillStore;
  promptStore?: PromptStore;
  fsRoots?: string[];
}) {
  const app = Fastify({ logger: true });
  const sessions = new SessionManager();
  const workspaces = options?.workspaceStore ?? new WorkspaceStore();
  const kanban = options?.kanbanStore ?? new KanbanStore();
  const memory = options?.memoryStore ?? new MemoryStore();
  const swarms = options?.swarmStore ?? new SwarmStore();
  const skills = options?.skillStore ?? new SkillStore();
  const prompts = options?.promptStore ?? new PromptStore();
  const fsRoots = options?.fsRoots ?? defaultRoots();

  // When a dispatched agent session exits, advance its kanban card.
  sessions.on("session-exit", (ev: { sessionId: string; code: number | null }) => {
    const card = kanban.list().find((c) => c.sessionId === ev.sessionId);
    if (!card || card.column !== "in_progress") return;
    kanban.update(card.id, {
      column: ev.code === 0 ? "done" : "in_review",
    });
  });

  // Desktop (Tauri) loads static UI assets and calls 127.0.0.1:4318 directly.
  await app.register(cors, {
    origin: [
      /^https?:\/\/127\.0\.0\.1(:\d+)?$/,
      /^https?:\/\/localhost(:\d+)?$/,
      /^https?:\/\/tauri\.localhost$/,
      "tauri://localhost",
    ],
  });
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

  app.post<{ Params: { id: string }; Body: { data?: string } }>(
    "/api/sessions/:id/write",
    async (req, reply) => {
      const data = req.body?.data;
      if (typeof data !== "string") return reply.code(400).send({ error: "data required" });
      if (!sessions.get(req.params.id)) return reply.code(404).send({ error: "session not found" });
      const ok = sessions.write(req.params.id, data);
      if (!ok) return reply.code(500).send({ error: "write failed" });
      return { ok: true };
    },
  );

  app.post<{ Body: { text?: string; target?: string } }>(
    "/api/sessions/broadcast",
    async (req, reply) => {
      const text = req.body?.text ?? "";
      if (!text.trim()) return reply.code(400).send({ error: "text required" });
      const target = (req.body?.target ?? "*").trim();
      const all = sessions.list();
      let ids: string[] = [];
      if (target === "*" || target === "all") {
        ids = all.map((s) => s.id);
      } else if (target.startsWith("@")) {
        const role = target.slice(1);
        for (const swarm of swarms.list()) {
          for (const m of swarm.members) {
            if (m.role === role && m.sessionId) ids.push(m.sessionId);
          }
        }
      } else {
        ids = [target];
      }
      const written: string[] = [];
      for (const id of ids) {
        if (sessions.get(id) && sessions.write(id, text)) written.push(id);
      }
      if (written.length === 0) return reply.code(404).send({ error: "no matching sessions" });
      return { written };
    },
  );

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


  app.get("/api/fs/roots", async () => ({ roots: fsRoots }));

  app.get<{ Querystring: { root?: string; q?: string } }>(
    "/api/fs/search",
    async (req, reply) => {
      const root = req.query.root || fsRoots[0];
      const q = req.query.q ?? "";
      if (!root || !fsRoots.includes(root)) {
        return reply.code(400).send({ error: "invalid root" });
      }
      try {
        return { root, query: q, entries: searchFsFiles(root, q) };
      } catch (err) {
        return reply.code(400).send({ error: err instanceof Error ? err.message : String(err) });
      }
    },
  );

  app.get<{ Querystring: { root?: string; path?: string } }>(
    "/api/fs/tree",
    async (req, reply) => {
      const root = req.query.root || fsRoots[0];
      if (!root || !fsRoots.includes(root)) {
        return reply.code(400).send({ error: "invalid root" });
      }
      try {
        return { root, path: req.query.path || ".", entries: listDir(root, req.query.path || ".") };
      } catch (err) {
        const code = err instanceof PathEscapeError ? 400 : 400;
        return reply.code(code).send({ error: err instanceof Error ? err.message : String(err) });
      }
    },
  );

  app.get<{ Querystring: { root?: string; path?: string } }>(
    "/api/fs/file",
    async (req, reply) => {
      const root = req.query.root || fsRoots[0];
      const rel = req.query.path;
      if (!root || !fsRoots.includes(root) || !rel) {
        return reply.code(400).send({ error: "root and path required" });
      }
      try {
        return { file: readFsFile(root, rel) };
      } catch (err) {
        return reply.code(400).send({ error: err instanceof Error ? err.message : String(err) });
      }
    },
  );

  app.put<{ Body: { root?: string; path?: string; content?: string } }>(
    "/api/fs/file",
    async (req, reply) => {
      const root = req.body?.root || fsRoots[0];
      const rel = req.body?.path;
      const content = req.body?.content;
      if (!root || !fsRoots.includes(root) || !rel || typeof content !== "string") {
        return reply.code(400).send({ error: "root, path, and content required" });
      }
      try {
        return { file: writeFsFile(root, rel, content) };
      } catch (err) {
        return reply.code(400).send({ error: err instanceof Error ? err.message : String(err) });
      }
    },
  );

  app.get<{ Querystring: { root?: string; path?: string } }>(
    "/api/fs/stat",
    async (req, reply) => {
      const root = req.query.root || fsRoots[0];
      const rel = req.query.path;
      if (!root || !fsRoots.includes(root) || !rel) {
        return reply.code(400).send({ error: "root and path required" });
      }
      try {
        return { stat: statFsFile(root, rel) };
      } catch (err) {
        return reply.code(400).send({ error: err instanceof Error ? err.message : String(err) });
      }
    },
  );

  const memoryFor = (cwd?: string) =>
    cwd?.trim() ? memory.withDir(resolveMemoryDir(cwd.trim())) : memory;

  app.get<{ Querystring: { cwd?: string } }>("/api/memory", async (req) => {
    const store = memoryFor(req.query.cwd);
    return {
      notes: store.list(),
      directory: store.directory,
      links: store.links(),
    };
  });

  app.get<{ Params: { id: string }; Querystring: { cwd?: string } }>("/api/memory/:id", async (req, reply) => {
    const note = memoryFor(req.query.cwd).get(req.params.id);
    if (!note) return reply.code(404).send({ error: "note not found" });
    return { note };
  });

  app.post<{ Body: { title?: string; content?: string; id?: string; cwd?: string } }>(
    "/api/memory",
    async (req, reply) => {
      try {
        const store = memoryFor(req.body?.cwd);
        const note = store.upsert({
          id: req.body?.id,
          title: req.body?.title ?? "",
          content: req.body?.content,
        });
        return reply.code(201).send({ note });
      } catch (err) {
        return reply.code(400).send({ error: err instanceof Error ? err.message : String(err) });
      }
    },
  );

  app.delete<{ Params: { id: string }; Querystring: { cwd?: string } }>("/api/memory/:id", async (req, reply) => {
    const ok = memoryFor(req.query.cwd).remove(req.params.id);
    if (!ok) return reply.code(404).send({ error: "note not found" });
    return reply.code(204).send();
  });


  app.get("/api/skills", async () => ({ skills: skills.list() }));

  app.get("/api/prompts", async () => ({ prompts: prompts.list() }));

  app.post<{ Body: UpsertPromptRequest }>("/api/prompts", async (req, reply) => {
    try {
      const prompt = prompts.upsert(req.body ?? ({} as UpsertPromptRequest));
      return reply.code(201).send({ prompt });
    } catch (err) {
      return reply.code(400).send({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  app.delete<{ Params: { id: string } }>("/api/prompts/:id", async (req, reply) => {
    const ok = prompts.remove(req.params.id);
    if (!ok) return reply.code(404).send({ error: "prompt not found" });
    return reply.code(204).send();
  });

  app.post<{ Params: { id: string }; Body: ApplyPromptRequest }>(
    "/api/prompts/:id/apply",
    async (req, reply) => {
      const prompt = prompts.get(req.params.id);
      if (!prompt) return reply.code(404).send({ error: "prompt not found" });
      const sessionId = req.body?.sessionId;
      if (!sessionId) return reply.code(400).send({ error: "sessionId required" });
      if (!sessions.get(sessionId)) return reply.code(404).send({ error: "session not found" });
      const ok = sessions.write(sessionId, prompt.body.endsWith("\n") ? prompt.body : `${prompt.body}\n`);
      if (!ok) return reply.code(500).send({ error: "failed to write to session" });
      return { prompt, sessionId };
    },
  );

  app.post<{ Params: { id: string }; Body: ApplySkillRequest }>(
    "/api/skills/:id/apply",
    async (req, reply) => {
      const skill = skills.get(req.params.id);
      if (!skill) return reply.code(404).send({ error: "skill not found" });
      const sessionId = req.body?.sessionId;
      if (!sessionId || !sessions.get(sessionId)) {
        return reply.code(404).send({ error: "session not found" });
      }
      const ok = sessions.write(sessionId, skill.prompt.endsWith("\n") ? skill.prompt : `${skill.prompt}\n`);
      if (!ok) return reply.code(500).send({ error: "failed to write to session" });
      return { ok: true, skill: { id: skill.id, name: skill.name } };
    },
  );

  app.get("/api/swarm", async () => ({ swarms: swarms.list() }));

  app.get<{ Params: { id: string } }>("/api/swarm/:id", async (req, reply) => {
    const swarm = swarms.get(req.params.id);
    if (!swarm) return reply.code(404).send({ error: "swarm not found" });
    return { swarm };
  });

  app.post<{ Body: CreateSwarmRequest }>("/api/swarm", async (req, reply) => {
    try {
      let draft = swarms.createDraft(req.body ?? ({} as CreateSwarmRequest));
      draft = swarms.save(draft);
      const sessionByRole: Record<string, string> = {};
      const createdSessions = [];
      for (const member of draft.members) {
        const agentId = member.agentId;
        try {
          const session = sessions.create({
            agentId,
            cwd: draft.cwd,
            title: member.title,
            initialInput: rolePrompt(member.role, draft.mission, draft.name),
          });
          sessionByRole[member.role] = session.id;
          createdSessions.push(session);
        } catch (err) {
          if (err instanceof AgentMissingError && agentId !== "shell") {
            const session = sessions.create({
              agentId: "shell",
              cwd: draft.cwd,
              title: `${member.title} (shell fallback)`,
              initialInput: rolePrompt(member.role, draft.mission, draft.name),
            });
            sessionByRole[member.role] = session.id;
            createdSessions.push(session);
          } else {
            for (const s of createdSessions) sessions.dispose(s.id);
            throw err;
          }
        }
      }
      const swarm = swarms.attachSessions(draft.id, sessionByRole);
      return reply.code(201).send({ swarm, sessions: createdSessions });
    } catch (err) {
      if (err instanceof AgentMissingError) {
        return reply.code(409).send({
          error: err.message,
          agentId: err.agentId,
          installHint: err.installHint,
        });
      }
      return reply.code(400).send({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  app.post<{ Params: { id: string }; Body: ClaimFileRequest }>(
    "/api/swarm/:id/claim",
    async (req, reply) => {
      try {
        const swarm = swarms.claim(req.params.id, req.body ?? ({} as ClaimFileRequest));
        return { swarm };
      } catch (err) {
        return reply.code(400).send({ error: err instanceof Error ? err.message : String(err) });
      }
    },
  );

  app.post<{ Params: { id: string }; Body: { status?: "running" | "done" | "failed" } }>(
    "/api/swarm/:id/status",
    async (req, reply) => {
      const status = req.body?.status;
      if (!status) return reply.code(400).send({ error: "status required" });
      const swarm = swarms.setStatus(req.params.id, status);
      if (!swarm) return reply.code(404).send({ error: "swarm not found" });
      return { swarm };
    },
  );

  app.post<{
    Params: { id: string };
    Body: { nodeId?: string; status?: "pending" | "doing" | "done" };
  }>("/api/swarm/:id/plan", async (req, reply) => {
    try {
      const nodeId = req.body?.nodeId;
      const status = req.body?.status;
      if (!nodeId || !status) return reply.code(400).send({ error: "nodeId and status required" });
      const swarm = swarms.setPlanNodeStatus(req.params.id, nodeId, status);
      return { swarm };
    } catch (err) {
      return reply.code(400).send({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  app.post<{
    Params: { id: string };
    Body: { parentId?: string; title?: string; role?: string };
  }>("/api/swarm/:id/plan/add", async (req, reply) => {
    try {
      const swarm = swarms.addPlanNode(req.params.id, {
        parentId: req.body?.parentId,
        title: req.body?.title ?? "",
        role: req.body?.role as never,
      });
      return { swarm };
    } catch (err) {
      return reply.code(400).send({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  app.post<{ Params: { id: string }; Body: PostSwarmMailRequest }>(
    "/api/swarm/:id/mail",
    async (req, reply) => {
      try {
        const swarm = swarms.postMail(req.params.id, req.body ?? ({} as PostSwarmMailRequest));
        return { swarm };
      } catch (err) {
        return reply.code(400).send({ error: err instanceof Error ? err.message : String(err) });
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

  return { app, sessions, workspaces, kanban, memory, swarms, skills, fsRoots };
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
