import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  AgentAvailability,
  AgentId,
  KanbanCard,
  KanbanColumn,
  LayoutPreset,
  SessionInfo,
  WorkspaceTemplate,
} from "@agentgrid/shared";
import { Terminal } from "./term/Terminal";
import { KanbanBoard } from "./board/KanbanBoard";
import { FilesPanel } from "./files/FilesPanel";
import { MemoryPanel } from "./files/MemoryPanel";
import { SwarmPanel } from "./swarm/SwarmPanel";
import { SkillsPanel } from "./swarm/SkillsPanel";
import { useKeyboardShortcuts } from "./hooks/useKeyboardShortcuts";
import { api } from "./lib/http";
import {
  THEME_IDS,
  THEME_LABELS,
  applyTheme,
  cycleTheme,
  loadTheme,
  type ThemeId,
} from "./lib/themes";


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
  const [templates, setTemplates] = useState<WorkspaceTemplate[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [agentId, setAgentId] = useState<AgentId>(saved.agentId ?? "shell");
  const [cwd, setCwd] = useState(saved.cwd ?? "");
  const [title, setTitle] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [layout, setLayout] = useState<LayoutPreset>(saved.layout ?? 1);
  const [workspaceName, setWorkspaceName] = useState(saved.workspaceName ?? "default");
  const [showHelp, setShowHelp] = useState(false);
  const [view, setView] = useState<"grid" | "board" | "files" | "memory" | "swarm" | "skills">("grid");
  const [theme, setTheme] = useState<ThemeId>(() => loadTheme());
  const [cards, setCards] = useState<KanbanCard[]>([]);

  useEffect(() => {
    const payload: SavedWorkspace = { workspaceName, layout, cwd, agentId };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  }, [workspaceName, layout, cwd, agentId]);

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  const refresh = useCallback(async () => {
    try {
      await api<{ ok: boolean }>("/api/health");
      setHealth("ok");
      const a = await api<{ agents: AgentAvailability[] }>("/api/agents");
      setAgents(a.agents);
      const s = await api<{ sessions: SessionInfo[] }>("/api/sessions");
      setSessions(s.sessions);
      setActiveId((prev) => prev ?? s.sessions[0]?.id ?? null);
      const w = await api<{ workspaces: WorkspaceTemplate[] }>("/api/workspaces");
      setTemplates(w.workspaces);
      const k = await api<{ cards: KanbanCard[] }>("/api/kanban");
      setCards(k.cards);
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
    nextCwd?: string,
  ): Promise<SessionInfo> => {
    const res = await api<{ session: SessionInfo }>("/api/sessions", {
      method: "POST",
      body: JSON.stringify({
        agentId: nextAgent,
        cwd: (nextCwd ?? cwd).trim() || undefined,
        title: nextTitle?.trim() || undefined,
      }),
    });
    return res.session;
  };

  const createSession = useCallback(async () => {
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
  }, [agentId, title, cwd]);

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

  const saveWorkspace = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const panes =
        sessions.length > 0
          ? sessions.map((s) => ({ agentId: s.agentId, title: s.title }))
          : [{ agentId, title: title || undefined }];
      const res = await api<{ workspace: WorkspaceTemplate }>("/api/workspaces", {
        method: "POST",
        body: JSON.stringify({
          name: workspaceName.trim() || "untitled",
          cwd: cwd.trim() || undefined,
          layout,
          panes,
        }),
      });
      setTemplates((prev) => {
        const others = prev.filter((w) => w.id !== res.workspace.id);
        return [res.workspace, ...others];
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }, [sessions, agentId, title, workspaceName, cwd, layout]);

  const openWorkspace = async (id: string) => {
    setBusy(true);
    setError(null);
    try {
      const res = await api<{
        workspace: WorkspaceTemplate;
        sessions: SessionInfo[];
      }>(`/api/workspaces/${id}/launch`, { method: "POST" });
      setWorkspaceName(res.workspace.name);
      setLayout(res.workspace.layout);
      setCwd(res.workspace.cwd ?? "");
      setSessions((prev) => [...prev, ...res.sessions]);
      setActiveId(res.sessions[0]?.id ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const deleteWorkspace = async (id: string) => {
    setBusy(true);
    try {
      await api<void>(`/api/workspaces/${id}`, { method: "DELETE" });
      setTemplates((prev) => prev.filter((w) => w.id !== id));
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

  const focusRelative = useCallback(
    (delta: number) => {
      if (sessions.length === 0) return;
      const idx = Math.max(
        0,
        sessions.findIndex((s) => s.id === activeId),
      );
      const next = sessions[(idx + delta + sessions.length) % sessions.length];
      if (next) setActiveId(next.id);
    },
    [sessions, activeId],
  );


  const createCard = async (cardTitle: string, cardAgent: AgentId) => {
    setBusy(true);
    setError(null);
    try {
      const res = await api<{ card: KanbanCard }>("/api/kanban/cards", {
        method: "POST",
        body: JSON.stringify({ title: cardTitle, agentId: cardAgent }),
      });
      setCards((prev) => [...prev, res.card]);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const moveCard = async (id: string, column: KanbanColumn) => {
    setBusy(true);
    try {
      const res = await api<{ card: KanbanCard }>(`/api/kanban/cards/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ column }),
      });
      setCards((prev) => prev.map((c) => (c.id === id ? res.card : c)));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const dispatchCard = async (id: string) => {
    setBusy(true);
    setError(null);
    try {
      const res = await api<{ card: KanbanCard; session: SessionInfo }>(
        `/api/kanban/cards/${id}/dispatch`,
        { method: "POST", body: JSON.stringify({ cwd: cwd.trim() || undefined }) },
      );
      setCards((prev) => prev.map((c) => (c.id === id ? res.card : c)));
      setSessions((prev) => [...prev, res.session]);
      setActiveId(res.session.id);
      setView("grid");
      setLayout(2);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const deleteCard = async (id: string) => {
    setBusy(true);
    try {
      await api<void>(`/api/kanban/cards/${id}`, { method: "DELETE" });
      setCards((prev) => prev.filter((c) => c.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const shortcutHandlers = useMemo(
    () => ({
      onLayout: setLayout,
      onLaunchPane: () => {
        void createSession();
      },
      onSaveWorkspace: () => {
        void saveWorkspace();
      },
      onToggleHelp: () => setShowHelp((v) => !v),
      onFocusNext: () => focusRelative(1),
      onFocusPrev: () => focusRelative(-1),
      onCycleTheme: () => setTheme((t) => cycleTheme(t)),
    }),
    [createSession, saveWorkspace, focusRelative],
  );

  useKeyboardShortcuts(shortcutHandlers);

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

        <div className="layout-row view-row">
          {(
            [
              ["grid", "Grid"],
              ["board", "Board"],
              ["files", "Files"],
              ["memory", "Memory"],
              ["swarm", "Swarm"],
              ["skills", "Skills"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              className={view === id ? "chip active" : "chip"}
              onClick={() => setView(id)}
            >
              {label}
            </button>
          ))}
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
          <span>Theme</span>
          <div className="layout-row">
            {THEME_IDS.map((id) => (
              <button
                key={id}
                type="button"
                className={theme === id ? "chip active" : "chip"}
                onClick={() => setTheme(id)}
              >
                {THEME_LABELS[id]}
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

        <button
          type="button"
          className="secondary"
          disabled={busy || health !== "ok"}
          onClick={() => void saveWorkspace()}
        >
          Save workspace template
        </button>

        {error && <pre className="error">{error}</pre>}

        <div className="session-list">
          <div className="section-label">Saved templates</div>
          {templates.length === 0 && <div className="empty">None yet — save one above</div>}
          {templates.map((w) => (
            <div key={w.id} className="template">
              <button
                type="button"
                className="template-main"
                disabled={busy}
                onClick={() => void openWorkspace(w.id)}
              >
                <span className="session-title">{w.name}</span>
                <span className="session-meta">
                  {w.layout}-pane · {w.panes.map((p) => p.agentId).join(" + ")}
                </span>
              </button>
              <button
                type="button"
                className="template-del"
                aria-label={`Delete ${w.name}`}
                onClick={() => void deleteWorkspace(w.id)}
              >
                ×
              </button>
            </div>
          ))}
        </div>

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

        <button type="button" className="help-toggle" onClick={() => setShowHelp((v) => !v)}>
          {showHelp ? "Hide shortcuts" : "Keyboard shortcuts (?)"}
        </button>
        {showHelp && (
          <pre className="help">
{`⌘/Ctrl+1|2|4     layout
⌘/Ctrl+Enter     launch pane
⌘/Ctrl+S         save template
⌘/Ctrl+[ ]       prev/next session
⌘/Ctrl+Shift+T   cycle theme
?                toggle this help`}
          </pre>
        )}

        <p className="footnote">
          Isolated from vibedeck. Templates live in ~/.agentgrid/workspaces.json
        </p>
      </aside>

      <main
        className={
          view === "grid" ? `main ${gridClass}` : "main board-main"
        }
      >
        {view === "board" ? (
          <KanbanBoard
            cards={cards}
            agents={agents}
            busy={busy || health !== "ok"}
            onCreate={(t, a) => void createCard(t, a)}
            onMove={(id, col) => void moveCard(id, col)}
            onDispatch={(id) => void dispatchCard(id)}
            onDelete={(id) => void deleteCard(id)}
          />
        ) : view === "files" ? (
          <FilesPanel initialRoot={cwd.trim() || undefined} />
        ) : view === "memory" ? (
          <MemoryPanel />
        ) : view === "swarm" ? (
          <SwarmPanel
            busy={busy || health !== "ok"}
            cwd={cwd}
            onLaunched={(swarm) => {
              setWorkspaceName(swarm.name);
              setLayout(4);
              setView("grid");
              void refresh();
            }}
          />
        ) : view === "skills" ? (
          <SkillsPanel
            sessions={sessions}
            activeSessionId={activeId}
            busy={busy || health !== "ok"}
          />
        ) : (
          slots.map((session, i) => (
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
          ))
        )}
      </main>
    </div>
  );
}
