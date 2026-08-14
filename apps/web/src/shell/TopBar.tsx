import type { ThemeId } from "../lib/themes";
import { THEME_IDS, THEME_LABELS } from "../lib/themes";
import { TAB_COLORS, type OpenWorkspace, type TabColor } from "./workspaceTabs";

interface Props {
  workspaces: OpenWorkspace[];
  activeWorkspaceId: string;
  onSelectWorkspace: (id: string) => void;
  onRenameWorkspace: (name: string) => void;
  onNewWorkspace: () => void;
  onCloseWorkspace: (id: string) => void;
  onColorWorkspace: (id: string, color: TabColor) => void;
  health: "checking" | "ok" | "down";
  theme: ThemeId;
  onTheme: (id: ThemeId) => void;
  inspectorOpen: boolean;
  onToggleInspector: () => void;
  dockOpen: boolean;
  onToggleDock: () => void;
  onOpenSettings: () => void;
}

export function TopBar({
  workspaces,
  activeWorkspaceId,
  onSelectWorkspace,
  onRenameWorkspace,
  onNewWorkspace,
  onCloseWorkspace,
  onColorWorkspace,
  health,
  theme,
  onTheme,
  inspectorOpen,
  onToggleInspector,
  dockOpen,
  onToggleDock,
  onOpenSettings,
}: Props) {
  const active = workspaces.find((w) => w.id === activeWorkspaceId);

  return (
    <header className="top-bar">
      <div className="top-brand" title="agentgrid">
        <div className="brand-mark">AG</div>
        <div className="brand-name">agentgrid</div>
      </div>

      <div className="workspace-tabs" role="tablist" aria-label="Workspaces">
        {workspaces.map((w, i) => (
          <button
            key={w.id}
            type="button"
            role="tab"
            aria-selected={w.id === activeWorkspaceId}
            className={
              w.id === activeWorkspaceId
                ? `workspace-tab active color-${w.color}`
                : `workspace-tab color-${w.color}`
            }
            onClick={() => onSelectWorkspace(w.id)}
            onContextMenu={(e) => {
              e.preventDefault();
              const next = TAB_COLORS[(TAB_COLORS.indexOf(w.color) + 1) % TAB_COLORS.length]!;
              onColorWorkspace(w.id, next);
            }}
            title={`${w.name} (⌘${i + 1}${i < 9 ? "" : ""}) · right-click to recolor`}
          >
            <span className="workspace-tab-dot" aria-hidden />
            <span className="workspace-tab-label">{w.name}</span>
            {workspaces.length > 1 && (
              <span
                className="workspace-tab-x"
                title="Close workspace tab (⌘W)"
                onClick={(e) => {
                  e.stopPropagation();
                  onCloseWorkspace(w.id);
                }}
              >
                ×
              </span>
            )}
          </button>
        ))}
        <button
          type="button"
          className="workspace-tab new"
          onClick={onNewWorkspace}
          title="New workspace tab (⌘T)"
          aria-label="New workspace tab"
        >
          +
        </button>
      </div>

      <label className="top-workspace">
        <span className="sr-only">Rename workspace</span>
        <input
          value={active?.name ?? ""}
          onChange={(e) => onRenameWorkspace(e.target.value)}
          placeholder="Workspace name"
        />
      </label>

      <div className={`health health-${health}`}>
        <span className="health-dot" aria-hidden />
        {health === "ok" ? "online" : health === "checking" ? "…" : "offline"}
        <span className="port-hint">:4318</span>
      </div>

      <div className="top-actions">
        <label className="theme-select">
          <span className="sr-only">Theme</span>
          <select
            value={theme}
            onChange={(e) => onTheme(e.target.value as ThemeId)}
            aria-label="Theme"
          >
            {THEME_IDS.map((id) => (
              <option key={id} value={id}>
                {THEME_LABELS[id]}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          className={dockOpen ? "chip active" : "chip"}
          onClick={onToggleDock}
          title="Toggle files dock"
        >
          Dock
        </button>
        <button
          type="button"
          className={inspectorOpen ? "chip active" : "chip"}
          onClick={onToggleInspector}
          title="Toggle inspector (⌘,)"
        >
          Inspect
        </button>
        <button
          type="button"
          className="chip"
          onClick={onOpenSettings}
          title="Settings"
        >
          Settings
        </button>
      </div>
    </header>
  );
}
