import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  AgentAvailability,
  AgentId,
  FsEntry,
  KanbanCard,
  KanbanColumn,
  LayoutPreset,
  SessionInfo,
  WorkspaceTemplate,
} from "@agentgrid/shared";
import { Terminal } from "./term/Terminal";
import { KanbanBoard } from "./board/KanbanBoard";
import { FilesPanel } from "./files/FilesPanel";
import { QuickOpen } from "./files/QuickOpen";
import { MemoryPanel } from "./files/MemoryPanel";
import { SwarmPanel } from "./swarm/SwarmPanel";
import { SkillsPanel } from "./swarm/SkillsPanel";
import { PromptsPanel } from "./prompts/PromptsPanel";
import { BrowserPanel } from "./browser/BrowserPanel";
import { SplitLayout } from "./grid/SplitLayout";
import {
  defaultTree,
  fillEmptyLeaves,
  listLeaves,
  splitLeaf,
  type PaneNode,
} from "./grid/splitTree";
import { useKeyboardShortcuts } from "./hooks/useKeyboardShortcuts";
import { api } from "./lib/http";
import {
  applyTheme,
  cycleTheme,
  loadTheme,
  type ThemeId,
} from "./lib/themes";
import { TopBar } from "./shell/TopBar";
import { ActivityRail } from "./shell/ActivityRail";
import { Inspector } from "./shell/Inspector";
import { CommandBar } from "./shell/CommandBar";
import type { AppView } from "./shell/types";

const STORAGE_KEY = "agentgrid.workspace.v1";

type LayoutMode = "preset" | "free";

interface SavedWorkspace {
  workspaceName: string;
  layout: LayoutPreset;
  layoutMode?: LayoutMode;
  splitTree?: PaneNode;
  cwd: string;
  agentId: AgentId;
  inspectorOpen?: boolean;
  dockOpen?: boolean;
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
  const [layoutMode, setLayoutMode] = useState<LayoutMode>(saved.layoutMode ?? "preset");
  const [splitTree, setSplitTree] = useState<PaneNode>(
    () => saved.splitTree ?? defaultTree([]),
  );
  const [workspaceName, setWorkspaceName] = useState(saved.workspaceName ?? "default");
  const [showHelp, setShowHelp] = useState(false);
  const [view, setView] = useState<AppView>("grid");
  const [theme, setTheme] = useState<ThemeId>(() => loadTheme());
  const [cards, setCards] = useState<KanbanCard[]>([]);
  const [inspectorOpen, setInspectorOpen] = useState(saved.inspectorOpen ?? true);
  const [dockOpen, setDockOpen] = useState(saved.dockOpen ?? false);
  const [quickOpen, setQuickOpen] = useState(false);
  const [openPath, setOpenPath] = useState<{ root: string; path: string } | null>(null);
  const [splitAxis, setSplitAxis] = useState<"row" | "col">("col");

  useEffect(() => {
    const payload: SavedWorkspace = {
      workspaceName,
      layout,
      layoutMode,
      splitTree,
      cwd,
      agentId,
      inspectorOpen,
      dockOpen,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  }, [workspaceName, layout, layoutMode, splitTree, cwd, agentId, inspectorOpen, dockOpen]);

  useEffect(() => {
    if (layoutMode !== "free") return;
    setSplitTree((prev) => fillEmptyLeaves(prev, sessions.map((s) => s.id)));
  }, [sessions, layoutMode]);

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
      setView("grid");
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
      setLayoutMode("preset");
      setLayout(ids.length <= 1 ? 1 : ids.length <= 2 ? 2 : 4);
      const created: SessionInfo[] = [];
      for (const id of ids) {
        const label = agents.find((a) => a.id === id)?.displayName ?? id;
        created.push(await createOne(id, `${name} · ${label}`));
      }
      setSessions((prev) => [...prev, ...created]);
      setActiveId(created[0]?.id ?? null);
      setView("grid");
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
      setLayoutMode("preset");
      setLayout(res.workspace.layout);
      setCwd(res.workspace.cwd ?? "");
      setSessions((prev) => [...prev, ...res.sessions]);
      setActiveId(res.sessions[0]?.id ?? null);
      setView("grid");
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

  const applySkillToSession = async (skillId: string, sessionId: string) => {
    setBusy(true);
    setError(null);
    try {
      await api(`/api/skills/${skillId}/apply`, {
        method: "POST",
        body: JSON.stringify({ sessionId }),
      });
      setActiveId(sessionId);
      setView("grid");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const createCard = async (cardTitle: string, cardAgent: AgentId, body?: string) => {
    setBusy(true);
    setError(null);
    try {
      const res = await api<{ card: KanbanCard }>("/api/kanban/cards", {
        method: "POST",
        body: JSON.stringify({ title: cardTitle, agentId: cardAgent, body }),
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

  const setPresetLayout = useCallback((n: LayoutPreset) => {
    setLayoutMode("preset");
    setLayout(n);
  }, []);

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
      setPresetLayout(2);
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

  const enableFreeLayout = useCallback(() => {
    setLayoutMode("free");
    setSplitTree((prev) => {
      if (prev.type === "leaf" && !prev.sessionId && sessions.length > 0) {
        return defaultTree(sessions.map((s) => s.id));
      }
      return fillEmptyLeaves(prev, sessions.map((s) => s.id));
    });
  }, [sessions]);

  const splitFocused = useCallback(() => {
    enableFreeLayout();
    const axis = splitAxis;
    setSplitAxis((a) => (a === "col" ? "row" : "col"));
    setSplitTree((prev) => {
      const leaves = listLeaves(prev);
      const focused =
        leaves.find((l) => l.sessionId === activeId) ?? leaves[leaves.length - 1];
      if (!focused) {
        const seed = defaultTree([]);
        return splitLeaf(seed, listLeaves(seed)[0]!.id, axis);
      }
      return splitLeaf(prev, focused.id, axis);
    });
    setView("grid");
  }, [activeId, enableFreeLayout, splitAxis]);

  /** Split a specific preset pane into free layout (H/V context menu). */
  const splitPaneSession = useCallback(
    (sessionId: string, axis: "row" | "col") => {
      setLayoutMode("free");
      setSplitTree(() => {
        const tree = defaultTree(sessions.map((s) => s.id));
        const leaves = listLeaves(tree);
        const focused =
          leaves.find((l) => l.sessionId === sessionId) ?? leaves[0];
        if (!focused) return tree;
        return splitLeaf(tree, focused.id, axis);
      });
      setView("grid");
    },
    [sessions],
  );

  const sendCommand = async (text: string, target: string) => {
    const body = text.endsWith("\n") ? text : `${text}\n`;
    await api("/api/sessions/broadcast", {
      method: "POST",
      body: JSON.stringify({ text: body, target }),
    });
  };

  const shortcutHandlers = useMemo(
    () => ({
      onLayout: setPresetLayout,
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
      onNewPane: () => {
        void createSession();
      },
      onSplit: () => splitFocused(),
      onToggleBoard: () => setView((v) => (v === "board" ? "grid" : "board")),
      onToggleSwarm: () => setView((v) => (v === "swarm" ? "grid" : "swarm")),
      onToggleInspector: () => setInspectorOpen((v) => !v),
      onQuickOpen: () => {
        setQuickOpen(true);
        setDockOpen(true);
        setView("grid");
      },
      onCloseSession: () => {
        if (activeId) void killSession(activeId);
      },
    }),
    [createSession, saveWorkspace, focusRelative, setPresetLayout, splitFocused, activeId],
  );

  useKeyboardShortcuts(shortcutHandlers);

  const slots = splitIds(sessions, layout);
  const gridClass = layoutMode === "free" ? "grid-free" : `grid-${layout}`;
  const showDock = dockOpen || view === "files";
  const stageIsGrid = view === "grid" || view === "files";

  const renderGrid = () =>
    layoutMode === "free" ? (
      <SplitLayout
        tree={splitTree}
        sessions={sessions}
        activeId={activeId}
        onChange={setSplitTree}
        onFocus={setActiveId}
        onSkillDrop={(skillId, sessionId) => void applySkillToSession(skillId, sessionId)}
      />
    ) : (
      slots.map((session, i) => (
        <section
          key={session?.id ?? `empty-${i}`}
          className={session && session.id === activeId ? "pane focused" : "pane"}
          onClick={() => session && setActiveId(session.id)}
          onDragOver={(e) => {
            const types = [...e.dataTransfer.types];
            if (
              types.includes("application/x-agentgrid-skill") ||
              types.includes("application/x-agentgrid-path")
            ) {
              e.preventDefault();
              e.currentTarget.classList.add("skill-drop-hover");
            }
          }}
          onDragLeave={(e) => e.currentTarget.classList.remove("skill-drop-hover")}
          onDrop={(e) => {
            e.preventDefault();
            e.currentTarget.classList.remove("skill-drop-hover");
            const skillId = e.dataTransfer.getData("application/x-agentgrid-skill");
            if (skillId && session) void applySkillToSession(skillId, session.id);
            const path = e.dataTransfer.getData("application/x-agentgrid-path");
            if (path && session) {
              void api(`/api/sessions/${session.id}/write`, {
                method: "POST",
                body: JSON.stringify({ data: path }),
              }).catch(() => undefined);
            }
          }}
        >
          <header className="pane-bar">
            <span>{session ? session.title : `Empty slot ${i + 1}`}</span>
            <span className="pane-actions">
              {session && <span className="pane-agent">{session.agentId}</span>}
              {session && (
                <>
                  <button
                    type="button"
                    className="chip"
                    title="Split horizontally"
                    onClick={(e) => {
                      e.stopPropagation();
                      splitPaneSession(session.id, "row");
                    }}
                  >
                    H
                  </button>
                  <button
                    type="button"
                    className="chip"
                    title="Split vertically"
                    onClick={(e) => {
                      e.stopPropagation();
                      splitPaneSession(session.id, "col");
                    }}
                  >
                    V
                  </button>
                </>
              )}
            </span>
          </header>
          <div className="pane-body">
            {session ? (
              <Terminal
                sessionId={session.id}
                onSplitH={() => splitPaneSession(session.id, "row")}
                onSplitV={() => splitPaneSession(session.id, "col")}
              />
            ) : (
              <div className="empty-pane">Launch an agent into this slot</div>
            )}
          </div>
        </section>
      ))
    );

  return (
    <div
      className={[
        "ade-shell",
        inspectorOpen ? "inspector-open" : "",
        showDock ? "dock-open" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <TopBar
        workspaceName={workspaceName}
        onWorkspaceName={setWorkspaceName}
        health={health}
        theme={theme}
        onTheme={setTheme}
        inspectorOpen={inspectorOpen}
        onToggleInspector={() => setInspectorOpen((v) => !v)}
        dockOpen={dockOpen}
        onToggleDock={() => {
          setDockOpen((v) => {
            const next = !v;
            if (!next && view === "files") setView("grid");
            return next;
          });
        }}
      />

      <ActivityRail
        view={view}
        onView={(v) => {
          setView(v);
          if (v === "files") setDockOpen(true);
        }}
      />

      <Inspector
        open={inspectorOpen}
        health={health}
        busy={busy}
        error={error}
        agents={agents}
        agentId={agentId}
        onAgentId={setAgentId}
        cwd={cwd}
        onCwd={setCwd}
        title={title}
        onTitle={setTitle}
        layout={layout}
        layoutMode={layoutMode}
        onPresetLayout={setPresetLayout}
        onLayoutMode={setLayoutMode}
        onEnableFree={enableFreeLayout}
        onLaunch={() => void createSession()}
        onSaveWorkspace={() => void saveWorkspace()}
        onLaunchPreset={(ids, name) => void launchPreset(ids, name)}
        workspaceName={workspaceName}
        templates={templates}
        onOpenWorkspace={(id) => void openWorkspace(id)}
        onDeleteWorkspace={(id) => void deleteWorkspace(id)}
        sessions={sessions}
        activeId={activeId}
        onFocusSession={setActiveId}
        onKillSession={(id) => void killSession(id)}
        showHelp={showHelp}
        onToggleHelp={() => setShowHelp((v) => !v)}
      />

      <div className="ade-center">
        {sessions.length > 0 && (view === "grid" || view === "files") && (
          <div className="session-tabs">
            {sessions.map((s) => (
              <button
                key={s.id}
                type="button"
                className={s.id === activeId ? "session-tab active" : "session-tab"}
                onClick={() => setActiveId(s.id)}
              >
                {s.title}
                <span
                  className="session-tab-x"
                  onClick={(e) => {
                    e.stopPropagation();
                    void killSession(s.id);
                  }}
                >
                  ×
                </span>
              </button>
            ))}
          </div>
        )}
        <main
          className={
            stageIsGrid
              ? `main ${gridClass}`
              : "main board-main"
          }
        >
          {view === "board" ? (
            <KanbanBoard
              cards={cards}
              sessions={sessions}
              agents={agents}
              busy={busy || health !== "ok"}
              onCreate={(t, a, body) => void createCard(t, a, body)}
              onMove={(id, col) => void moveCard(id, col)}
              onDispatch={(id) => void dispatchCard(id)}
              onDelete={(id) => void deleteCard(id)}
            />
          ) : view === "memory" ? (
            <MemoryPanel cwd={cwd.trim() || undefined} />
          ) : view === "swarm" ? (
            <SwarmPanel
              busy={busy || health !== "ok"}
              cwd={cwd}
              onLaunched={(swarm) => {
                setWorkspaceName(swarm.name);
                setPresetLayout(4);
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
          ) : view === "prompts" ? (
            <PromptsPanel
              sessions={sessions}
              activeSessionId={activeId}
              busy={busy || health !== "ok"}
            />
          ) : view === "browser" ? (
            <BrowserPanel />
          ) : (
            renderGrid()
          )}
        </main>

        {showDock && view !== "browser" && (
          <aside className="files-dock">
            <FilesPanel
              initialRoot={cwd.trim() || undefined}
              dock
              openPath={openPath}
            />
          </aside>
        )}
      </div>

      <CommandBar
        sessions={sessions}
        activeSessionId={activeId}
        busy={busy || health !== "ok"}
        onSend={sendCommand}
      />

      <QuickOpen
        open={quickOpen}
        root={cwd.trim() || undefined}
        onClose={() => setQuickOpen(false)}
        onOpen={(entry: FsEntry, root: string) => {
          setOpenPath({ root, path: entry.path });
          setDockOpen(true);
          setView("grid");
        }}
      />
    </div>
  );
}
