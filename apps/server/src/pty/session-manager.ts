import { EventEmitter } from "node:events";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import * as pty from "node-pty";
import { v4 as uuidv4 } from "uuid";
import { AGENT_SPECS, type AgentId, type SessionInfo } from "@agentgrid/shared";
import { resolveAgent } from "./agents.js";
import { RingBuffer } from "./ring-buffer.js";

const SCROLLBACK_BYTES = 2 * 1024 * 1024; // 2 MB

export interface CreateSessionOptions {
  agentId: AgentId;
  cwd?: string;
  cols?: number;
  rows?: number;
  title?: string;
  /** Text sent to the PTY after a short delay (kanban dispatch). */
  initialInput?: string;
}

export class AgentMissingError extends Error {
  constructor(
    public readonly agentId: AgentId,
    public readonly installHint: string,
  ) {
    super(`Agent "${agentId}" is not available on PATH`);
    this.name = "AgentMissingError";
  }
}

interface LiveSession {
  info: SessionInfo;
  term: pty.IPty;
  scrollback: RingBuffer;
  listeners: Set<(data: string) => void>;
  exitListeners: Set<(code: number | null) => void>;
}

export class SessionManager extends EventEmitter {
  private sessions = new Map<string, LiveSession>();

  list(): SessionInfo[] {
    return [...this.sessions.values()].map((s) => ({ ...s.info }));
  }

  get(id: string): SessionInfo | undefined {
    return this.sessions.get(id)?.info;
  }

  create(opts: CreateSessionOptions): SessionInfo {
    const resolved = resolveAgent(opts.agentId);
    if (!resolved) {
      throw new AgentMissingError(opts.agentId, AGENT_SPECS[opts.agentId].installHint);
    }

    const cols = opts.cols ?? 120;
    const rows = opts.rows ?? 40;
    const cwd = opts.cwd && opts.cwd.length > 0 ? opts.cwd : process.cwd();
    const id = uuidv4();
    const title = opts.title?.trim() || `${resolved.spec.displayName}`;

    const term = pty.spawn(resolved.resolvedCommand, resolved.spec.args, {
      name: "xterm-256color",
      cols,
      rows,
      cwd,
      env: {
        ...process.env,
        TERM: "xterm-256color",
        COLORTERM: "truecolor",
        AGENTGRID: "1",
        ...(opts.agentId === "shell"
          ? {
              ZDOTDIR: join(
                dirname(fileURLToPath(import.meta.url)),
                "../../shell-integration",
              ),
            }
          : {}),
      } as Record<string, string>,
    });

    if (opts.initialInput && opts.initialInput.length > 0) {
      const payload = opts.initialInput.endsWith("\n")
        ? opts.initialInput
        : `${opts.initialInput}\n`;
      setTimeout(() => {
        try {
          term.write(payload);
        } catch {
          // session may already be gone
        }
      }, 400);
    }

    const scrollback = new RingBuffer(SCROLLBACK_BYTES);
    const listeners = new Set<(data: string) => void>();
    const exitListeners = new Set<(code: number | null) => void>();

    const info: SessionInfo = {
      id,
      agentId: opts.agentId,
      cwd,
      cols,
      rows,
      createdAt: new Date().toISOString(),
      title,
    };

    const live: LiveSession = { info, term, scrollback, listeners, exitListeners };
    this.sessions.set(id, live);

    term.onData((data) => {
      scrollback.write(data);
      for (const fn of listeners) fn(data);
    });

    term.onExit(({ exitCode }) => {
      for (const fn of exitListeners) fn(exitCode);
      // Keep session metadata + scrollback until explicit dispose,
      // so a reconnect can still show the last output.
      try {
        term.kill();
      } catch {
        // already dead
      }
    });

    return { ...info };
  }

  write(id: string, data: string): boolean {
    const live = this.sessions.get(id);
    if (!live) return false;
    try {
      live.term.write(data);
      return true;
    } catch {
      return false;
    }
  }

  resize(id: string, cols: number, rows: number): boolean {
    const live = this.sessions.get(id);
    if (!live) return false;
    try {
      live.term.resize(cols, rows);
      live.info.cols = cols;
      live.info.rows = rows;
      return true;
    } catch {
      return false;
    }
  }

  /** Subscribe to live output; returns unsubscribe. Replays scrollback first. */
  subscribe(
    id: string,
    onData: (data: string) => void,
    onExit?: (code: number | null) => void,
  ): (() => void) | null {
    const live = this.sessions.get(id);
    if (!live) return null;

    const replay = live.scrollback.toString();
    if (replay) onData(replay);

    live.listeners.add(onData);
    if (onExit) live.exitListeners.add(onExit);

    return () => {
      live.listeners.delete(onData);
      if (onExit) live.exitListeners.delete(onExit);
    };
  }

  dispose(id: string): boolean {
    const live = this.sessions.get(id);
    if (!live) return false;
    try {
      live.term.kill();
    } catch {
      // ignore
    }
    live.listeners.clear();
    live.exitListeners.clear();
    this.sessions.delete(id);
    return true;
  }

  disposeAll(): void {
    for (const id of [...this.sessions.keys()]) {
      this.dispose(id);
    }
  }
}
