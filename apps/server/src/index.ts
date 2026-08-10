import Fastify from "fastify";
import websocket from "@fastify/websocket";
import {
  DEFAULT_SERVER_PORT,
  isAgentId,
  type ClientMessage,
  type CreateSessionRequest,
  type ServerMessage,
} from "@agentgrid/shared";
import { detectAgents } from "./pty/agents.js";
import { AgentMissingError, SessionManager } from "./pty/session-manager.js";

export async function buildApp() {
  const app = Fastify({ logger: true });
  const sessions = new SessionManager();

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

  return { app, sessions };
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
