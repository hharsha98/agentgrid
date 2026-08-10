import { useCallback, useEffect, useMemo, useState } from "react";
import type { AgentAvailability, AgentId, SessionInfo } from "@agentgrid/shared";
import { Terminal } from "./term/Terminal";

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = (await res.json()) as { error?: string; installHint?: string };
      detail = body.installHint
        ? `${body.error ?? detail}\n${body.installHint}`
        : (body.error ?? detail);
    } catch {
      // ignore
    }
    throw new Error(detail);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

type LayoutPreset = 1 | 2 | 4;

const STORAGE_KEY = "agentgrid.workspace.v1";

interface SavedWorkspace {
  workspaceName: string;
  layout: LayoutPreset;
  cwd: string;
  agentId: AgentId;
}

function loadSavedWorkspace(): Partial<SavedWorkspace> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as SavedWorkspace;
  } catch {
    return {};
  }
}

function splitIds(sessions: SessionInfo[], count: LayoutPreset): (SessionInfo | null)[] {
  return Array.from({ length: count }, (_, i) => sessions[i] ?? null);
}

export function App() {
  const saved = loadSavedWorkspace();
  const [health, setHealth] = useState<"checking" | "ok" | "down">("checking");
  const [agents, setAgents] = useState<AgentAvailability[]>([]);
  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [agentId, setAgentId] = useState<AgentId>(saved.agentId ?? "shell");
  const [cwd, setCwd] = useState(saved.cwd ?? "");
  const [title, setTitle] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [layout, setLayout] = useState<LayoutPreset>(saved.layout ?? 1);
  const [workspaceName, setWorkspaceName] = useState(saved.workspaceName ?? "default");

  useEffect(() => {
    const payload: SavedWorkspace = { workspaceName, layout, cwd, agentId };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  }, [workspaceName, layout, cwd, agentId]);

  const refresh = useCallback(async () => {
    try {
      await api<{ ok: boolean }>("/api/health");
      setHealth("ok");
      const a = await api<{ agents: AgentAvailability[] }>("/api/agents");
      setAgents(a.agents);
      const s = await api<{ sessions: SessionInfo[] }>("/api/sessions");
      setSessions(s.sessions);
      setActiveId((prev) => prev ?? s.sessions[0]?.id ?? null);
      setError(null);
    } catch (err) {
      setHealth("down");
      setError(err instanceof Error ? err.message : String(err));
    }
  }, []);

  useEffect(() => {
    void refresh();
    const t = setInterval(() => void refresh(), 5000);
    return () => clearInterval(t);
  }, [refresh]);

  const availableAgents = useMemo(
    () => agents.filter((a) => a.available),
    [agents],
  );

  const isAvailable = useCallback(
    (id: AgentId) => availableAgents.some((a) => a.id === id),
    [availableAgents],
  );

  useEffect(() => {
    if (availableAgents.length === 0) return;
    if (!availableAgents.some((a) => a.id === agentId)) {
      setAgentId(availableAgents[0]!.id);
    }
  }, [availableAgents, agentId]);

  const createOne = async (
    nextAgent: AgentId,
    nextTitle?: string,
  ): Promise<SessionInfo> => {
    const res = await api<{ session: SessionInfo }>("/api/sessions", {
      method: "POST",
      body: JSON.stringify({
        agentId: nextAgent,
        cwd: cwd.trim() || undefined,
        title: nextTitle?.trim() || undefined,
      }),
    });
    return res.session;
  };

  const createSession = async () => {
    setBusy(true);
    setError(null);
    try {
      const session = await createOne(agentId, title);
      setSessions((prev) => [...prev, session]);
      setActiveId(session.id);
      setTitle("");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  /** BridgeSpace-style: open several agents at once into the grid. */
  const launchPreset = async (ids: AgentId[], name: string) => {
    setBusy(true);
    setError(null);
    try {
      const missing = ids.filter((id) => !isAvailable(id));
      if (missing.length > 0) {
        throw new Error(
          `Missing agents: ${missing.join(", ")}. Install their CLIs first.`,
        );
      }
      setWorkspaceName(name);
      setLayout(ids.length <= 1 ? 1 : ids.length <= 2 ? 2 : 4);
      const created: SessionInfo[] = [];
      for (const id of ids) {
        const label = agents.find((a) => a.id === id)?.displayName ?? id;
        created.push(await createOne(id, `${name} · ${label}`));
      }
      setSessions((prev) => [...prev, ...created]);
      setActiveId(created[0]?.id ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const killSession = async (id: string) => {
    setBusy(true);
    try {
      await api<void>(`/api/sessions/${id}`, { method: "DELETE" });
      setSessions((prev) => prev.filter((s) => s.id !== id));
      setActiveId((prev) => (prev === id ? null : prev));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const slots = splitIds(sessions, layout);
  const gridClass =
    layout === 1 ? "grid-1" : layout === 2 ? "grid-2" : "grid-4";

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">AG</div>
          <div>
            <div className="brand-name">agentgrid</div>
            <div className="brand-sub">multi-agent terminal grid</div>
          </div>
        </div>

        <div className={`health health-${health}`}>
          server {health === "ok" ? "online" : health === "checking" ? "…" : "offline"}
          <span className="port-hint">:4318 / :5318</span>
        </div>

        <label className="field">
          <span>Workspace</span>
          <input
            value={workspaceName}
            onChange={(e) => setWorkspaceName(e.target.value)}
            placeholder="e.g. UI cleanup"
          />
        </label>

        <label className="field">
          <span>Layout</span>
          <div className="layout-row">
            {([1, 2, 4] as LayoutPreset[]).map((n) => (
              <button
                key={n}
                type="button"
                className={layout === n ? "chip active" : "chip"}
                onClick={() => setLayout(n)}
              >
                {n}
              </button>
            ))}
          </div>
        </label>

        <label className="field">
          <span>Quick launch</span>
          <div className="preset-col">
            <button
              type="button"
              className="secondary"
              disabled={busy || health !== "ok"}
              onClick={() => void launchPreset(["claude", "codex"], workspaceName || "pair")}
            >
              Claude + Codex
            </button>
            <button
              type="button"
              className="secondary"
              disabled={busy || health !== "ok"}
              onClick={() =>
                void launchPreset(["claude", "cursor-agent"], workspaceName || "pair")
              }
            >
              Claude + Cursor
            </button>
            <button
              type="button"
              className="secondary"
              disabled={busy || health !== "ok"}
              onClick={() => void launchPreset(["shell", "shell"], workspaceName || "shells")}
            >
              Two shells
            </button>
          </div>
        </label>

        <label className="field">
          <span>Agent</span>
          <select value={agentId} onChange={(e) => setAgentId(e.target.value as AgentId)}>
            {agents.map((a) => (
              <option key={a.id} value={a.id} disabled={!a.available}>
                {a.displayName}
                {!a.available ? " (missing)" : ""}
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          <span>Working directory</span>
          <input
            value={cwd}
            onChange={(e) => setCwd(e.target.value)}
            placeholder="leave blank = server cwd"
          />
        </label>

        <label className="field">
          <span>Pane title</span>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="optional"
          />
        </label>

        <button
          type="button"
          className="primary"
          disabled={busy || health !== "ok"}
          onClick={() => void createSession()}
        >
          Launch pane
        </button>

        {error && <pre className="error">{error}</pre>}

        <div className="session-list">
          <div className="section-label">Sessions</div>
          {sessions.length === 0 && <div className="empty">No sessions yet</div>}
          {sessions.map((s) => (
            <button
              key={s.id}
              type="button"
              className={s.id === activeId ? "session active" : "session"}
              onClick={() => setActiveId(s.id)}
            >
              <span className="session-title">{s.title}</span>
              <span className="session-meta">{s.agentId}</span>
              <span
                className="kill"
                role="button"
                tabIndex={0}
                onClick={(e) => {
                  e.stopPropagation();
                  void killSession(s.id);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.stopPropagation();
                    void killSession(s.id);
                  }
                }}
              >
                ×
              </span>
            </button>
          ))}
        </div>

        <p className="footnote">
          Isolated from vibedeck. Claude Code owns vibedeck; Cursor owns agentgrid. No shared git.
        </p>
      </aside>

      <main className={`main ${gridClass}`}>
        {slots.map((session, i) => (
          <section
            key={session?.id ?? `empty-${i}`}
            className={session && session.id === activeId ? "pane focused" : "pane"}
            onClick={() => session && setActiveId(session.id)}
          >
            <header className="pane-bar">
              <span>{session ? session.title : `Empty slot ${i + 1}`}</span>
              {session && <span className="pane-agent">{session.agentId}</span>}
            </header>
            <div className="pane-body">
              {session ? (
                <Terminal sessionId={session.id} />
              ) : (
                <div className="empty-pane">Launch an agent into this slot</div>
              )}
            </div>
          </section>
        ))}
      </main>
    </div>
  );
}
