import { EventEmitter } from "node:events";
import { existsSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as pty from "node-pty";
import { v4 as uuidv4 } from "uuid";
import { AGENT_SPECS, type AgentId, type SessionInfo } from "@agentgrid/shared";
import { resolveAgent } from "./agents.js";
import { formatInitialInput } from "./dispatch-input.js";
import { RingBuffer } from "./ring-buffer.js";
import { shellIntegration } from "./shell-integration.js";

const SCROLLBACK_BYTES = 2 * 1024 * 1024; // 2 MB
const INITIAL_INPUT_FALLBACK_MS = 2500;
const INITIAL_INPUT_AFTER_OUTPUT_MS = 180;

export interface CreateSessionOptions {
  agentId: AgentId;
  cwd?: string;
  cols?: number;
  rows?: number;
  title?: string;
  /** Text sent to the PTY after it produces output (kanban / swarm dispatch). */
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

export class InvalidCwdError extends Error {
  constructor(public readonly cwd: string) {
    super(`Working directory does not exist or is not a directory: ${cwd}`);
    this.name = "InvalidCwdError";
  }
}

export class SessionSpawnError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SessionSpawnError";
  }
}

interface LiveSession {
  info: SessionInfo;
  term: pty.IPty;
  scrollback: RingBuffer;
  listeners: Set<(data: string) => void>;
  exitListeners: Set<(code: number | null) => void>;
}

function childEnv(): Record<string, string> {
  const env: Record<string, string> = {};
  for (const [key, value] of Object.entries(process.env)) {
    if (typeof value === "string") env[key] = value;
  }
  env.TERM = "xterm-256color";
  env.COLORTERM = "truecolor";
  env.AGENTGRID = "1";
  return env;
}

export interface SessionManagerOptions {
  /** When true, missing vendor CLIs spawn the local simulator instead of failing. */
  demoPublic?: boolean;
  /** Test seam. Defaults to PATH lookup. */
  resolve?: typeof resolveAgent;
}

function simulatorScript(): string {
  return join(dirname(fileURLToPath(import.meta.url)), "sim-agent.mjs");
}

export class SessionManager extends EventEmitter {
  private sessions = new Map<string, LiveSession>();
  private readonly demoPublic: boolean;
  private readonly resolve: typeof resolveAgent;

  constructor(options: SessionManagerOptions = {}) {
    super();
    this.demoPublic = options.demoPublic ?? false;
    this.resolve = options.resolve ?? resolveAgent;
  }

  list(): SessionInfo[] {
    return [...this.sessions.values()].map((s) => ({ ...s.info }));
  }

  get(id: string): SessionInfo | undefined {
    const live = this.sessions.get(id);
    return live ? { ...live.info } : undefined;
  }

  create(opts: CreateSessionOptions): SessionInfo {
    const resolved = this.resolve(opts.agentId);
    const simulated = !resolved && this.demoPublic && opts.agentId !== "shell";
    if (!resolved && !simulated) {
      throw new AgentMissingError(opts.agentId, AGENT_SPECS[opts.agentId].installHint);
    }

    const cols = opts.cols ?? 120;
    const rows = opts.rows ?? 40;
    const cwd = opts.cwd && opts.cwd.length > 0 ? opts.cwd : process.cwd();
    if (!existsSync(cwd) || !statSync(cwd).isDirectory()) {
      throw new InvalidCwdError(cwd);
    }
    const id = uuidv4();
    const spec = resolved?.spec ?? AGENT_SPECS[opts.agentId];
    const title = opts.title?.trim() || spec.displayName;

    const integration = resolved && opts.agentId === "shell" ? shellIntegration(spec) : null;
    const command = simulated ? process.execPath : resolved!.resolvedCommand;
    const args = simulated
      ? [simulatorScript(), opts.agentId]
      : (integration?.args ?? spec.args);
    const env = {
      ...childEnv(),
      ...(integration?.extraEnv ?? {}),
      ...(simulated ? { AGENTGRID_SIM: "1", AGENTGRID_SIM_AGENT: opts.agentId } : {}),
    };

    if (simulated && !existsSync(simulatorScript())) {
      throw new SessionSpawnError(`Simulator script missing: ${simulatorScript()}`);
    }

    let term: pty.IPty;
    try {
      term = pty.spawn(command, args, {
        name: "xterm-256color",
        cols,
        rows,
        cwd,
        env,
      });
    } catch (err) {
      throw new SessionSpawnError(err instanceof Error ? err.message : String(err));
    }

    const payload =
      opts.initialInput && opts.initialInput.trim().length > 0
        ? formatInitialInput(opts.agentId, opts.initialInput)
        : "";
    let initialSent = false;
    const box: { live?: LiveSession } = {};
    const sendInitial = () => {
      if (initialSent || !payload) return;
      if (box.live?.info.status === "exited") return;
      initialSent = true;
      try {
        term.write(payload);
      } catch {
        // session may already be gone
      }
    };
    if (payload) {
      setTimeout(sendInitial, INITIAL_INPUT_FALLBACK_MS);
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
      status: "running",
      exitCode: null,
      runtime: simulated ? "simulated" : "native",
    };

    const live: LiveSession = { info, term, scrollback, listeners, exitListeners };
    box.live = live;
    this.sessions.set(id, live);

    term.onData((data) => {
      scrollback.write(data);
      for (const fn of listeners) fn(data);
      if (payload && !initialSent) {
        setTimeout(sendInitial, INITIAL_INPUT_AFTER_OUTPUT_MS);
      }
    });

    term.onExit(({ exitCode }) => {
      live.info.status = "exited";
      live.info.exitCode = exitCode ?? null;
      for (const fn of exitListeners) fn(exitCode ?? null);
      this.emit("session-exit", { sessionId: id, code: exitCode ?? null });
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
    if (!live || live.info.status === "exited") return false;
    try {
      live.term.write(data);
      return true;
    } catch {
      return false;
    }
  }

  resize(id: string, cols: number, rows: number): boolean {
    const live = this.sessions.get(id);
    if (!live || live.info.status === "exited") return false;
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

    if (live.info.status === "exited") {
      onExit?.(live.info.exitCode ?? null);
      return () => undefined;
    }

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
