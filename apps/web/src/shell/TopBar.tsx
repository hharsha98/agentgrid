import type { ThemeId } from "../lib/themes";
import { THEME_IDS, THEME_LABELS } from "../lib/themes";

interface Props {
  workspaceName: string;
  onWorkspaceName: (name: string) => void;
  health: "checking" | "ok" | "down";
  theme: ThemeId;
  onTheme: (id: ThemeId) => void;
  inspectorOpen: boolean;
  onToggleInspector: () => void;
  dockOpen: boolean;
  onToggleDock: () => void;
}

export function TopBar({
  workspaceName,
  onWorkspaceName,
  health,
  theme,
  onTheme,
  inspectorOpen,
  onToggleInspector,
  dockOpen,
  onToggleDock,
}: Props) {
  return (
    <header className="top-bar">
      <div className="top-brand">
        <div className="brand-mark">AG</div>
        <div className="brand-name">agentgrid</div>
      </div>

      <label className="top-workspace">
        <span className="sr-only">Workspace</span>
        <input
          value={workspaceName}
          onChange={(e) => onWorkspaceName(e.target.value)}
          placeholder="Workspace name"
        />
      </label>

      <div className={`health health-${health}`}>
        {health === "ok" ? "online" : health === "checking" ? "…" : "offline"}
        <span className="port-hint">:4318</span>
      </div>

      <div className="top-actions">
        <div className="layout-row">
          {THEME_IDS.map((id) => (
            <button
              key={id}
              type="button"
              className={theme === id ? "chip active" : "chip"}
              onClick={() => onTheme(id)}
            >
              {THEME_LABELS[id]}
            </button>
          ))}
        </div>
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
      </div>
    </header>
  );
}
