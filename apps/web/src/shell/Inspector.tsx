import type {
  AgentAvailability,
  AgentId,
  LayoutPreset,
  SessionInfo,
  WorkspaceTemplate,
} from "@agentgrid/shared";

type LayoutMode = "preset" | "free";

export interface InspectorProps {
  open: boolean;
  health: "checking" | "ok" | "down";
  busy: boolean;
  error: string | null;
  agents: AgentAvailability[];
  agentId: AgentId;
  onAgentId: (id: AgentId) => void;
  cwd: string;
  onCwd: (v: string) => void;
  title: string;
  onTitle: (v: string) => void;
  layout: LayoutPreset;
  layoutMode: LayoutMode;
  onPresetLayout: (n: LayoutPreset) => void;
  onLayoutMode: (m: LayoutMode) => void;
  onEnableFree: () => void;
  onLaunch: () => void;
  onSaveWorkspace: () => void;
  onLaunchPreset: (ids: AgentId[], name: string) => void;
  workspaceName: string;
  templates: WorkspaceTemplate[];
  onOpenWorkspace: (id: string) => void;
  onDeleteWorkspace: (id: string) => void;
  sessions: SessionInfo[];
  activeId: string | null;
  onFocusSession: (id: string) => void;
  onKillSession: (id: string) => void;
  showHelp: boolean;
  onToggleHelp: () => void;
}

const PRESETS: LayoutPreset[] = [1, 2, 4, 6, 8, 10, 12, 14, 16];

export function Inspector(p: InspectorProps) {
  const ok = p.health === "ok";
  if (!p.open) return <aside className="inspector collapsed" aria-hidden />;

  return (
    <aside className="inspector">
      <div className="section-label">Layout</div>
      <div className="layout-row">
        <button
          type="button"
          className={p.layoutMode === "preset" ? "chip active" : "chip"}
          onClick={() => p.onLayoutMode("preset")}
        >
          Preset
        </button>
        <button
          type="button"
          className={p.layoutMode === "free" ? "chip active" : "chip"}
          onClick={() => p.onEnableFree()}
        >
          Free
        </button>
      </div>
      {p.layoutMode === "preset" && (
        <div className="layout-row">
          {PRESETS.map((n) => (
            <button
              key={n}
              type="button"
              className={p.layout === n ? "chip active" : "chip"}
              onClick={() => p.onPresetLayout(n)}
            >
              {n}
            </button>
          ))}
        </div>
      )}
      {p.layoutMode === "free" && (
        <p className="layout-hint">H/V on panes · drag handles · ⌘D split</p>
      )}

      <div className="section-label">Quick launch</div>
      <div className="preset-col">
        <button
          type="button"
          className="secondary"
          disabled={p.busy || !ok}
          onClick={() => p.onLaunchPreset(["claude", "codex"], p.workspaceName || "pair")}
        >
          Claude + Codex
        </button>
        <button
          type="button"
          className="secondary"
          disabled={p.busy || !ok}
          onClick={() => p.onLaunchPreset(["claude", "cursor-agent"], p.workspaceName || "pair")}
        >
          Claude + Cursor
        </button>
        <button
          type="button"
          className="secondary"
          disabled={p.busy || !ok}
          onClick={() => p.onLaunchPreset(["shell", "shell"], p.workspaceName || "shells")}
        >
          Two shells
        </button>
      </div>

      <label className="field">
        <span>Agent</span>
        <select value={p.agentId} onChange={(e) => p.onAgentId(e.target.value as AgentId)}>
          {p.agents.map((a) => (
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
          value={p.cwd}
          onChange={(e) => p.onCwd(e.target.value)}
          placeholder="leave blank = server cwd"
        />
      </label>

      <label className="field">
        <span>Pane title</span>
        <input
          value={p.title}
          onChange={(e) => p.onTitle(e.target.value)}
          placeholder="optional"
        />
      </label>

      <button
        type="button"
        className="primary"
        disabled={p.busy || !ok}
        onClick={() => p.onLaunch()}
      >
        Launch pane
      </button>
      <button
        type="button"
        className="secondary"
        disabled={p.busy || !ok}
        onClick={() => p.onSaveWorkspace()}
      >
        Save workspace template
      </button>

      {p.error && <pre className="error">{p.error}</pre>}

      <div className="session-list">
        <div className="section-label">Saved templates</div>
        {p.templates.length === 0 && <div className="empty">None yet</div>}
        {p.templates.map((w) => (
          <div key={w.id} className="template">
            <button
              type="button"
              className="template-main"
              disabled={p.busy}
              onClick={() => p.onOpenWorkspace(w.id)}
            >
              <span className="session-title">{w.name}</span>
              <span className="session-meta">
                {w.layout}-pane · {w.panes.map((x) => x.agentId).join(" + ")}
              </span>
            </button>
            <button
              type="button"
              className="template-del"
              aria-label={`Delete ${w.name}`}
              onClick={() => p.onDeleteWorkspace(w.id)}
            >
              ×
            </button>
          </div>
        ))}
      </div>

      <div className="session-list">
        <div className="section-label">Sessions</div>
        {p.sessions.length === 0 && <div className="empty">No sessions yet</div>}
        {p.sessions.map((s) => (
          <button
            key={s.id}
            type="button"
            className={s.id === p.activeId ? "session active" : "session"}
            onClick={() => p.onFocusSession(s.id)}
          >
            <span className="session-title">{s.title}</span>
            <span className="session-meta">{s.agentId}</span>
            <span
              className="kill"
              role="button"
              tabIndex={0}
              onClick={(e) => {
                e.stopPropagation();
                p.onKillSession(s.id);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.stopPropagation();
                  p.onKillSession(s.id);
                }
              }}
            >
              ×
            </span>
          </button>
        ))}
      </div>

      <button type="button" className="help-toggle" onClick={() => p.onToggleHelp()}>
        {p.showHelp ? "Hide shortcuts" : "Keyboard shortcuts (?)"}
      </button>
      {p.showHelp && (
        <pre className="help">
{`⌘/Ctrl+N         new pane
⌘/Ctrl+D         split focused (free)
⌘/Ctrl+B         board
⌘/Ctrl+Shift+S   swarm
⌘/Ctrl+S         save template
⌘/Ctrl+,         toggle inspector
⌘/Ctrl+1|2|4|0   preset layout
⌘/Ctrl+F         terminal search
?                this help`}
        </pre>
      )}
      <p className="footnote">Isolated from vibedeck · ~/.agentgrid/</p>
    </aside>
  );
}
