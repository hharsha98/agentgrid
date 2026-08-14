import { useEffect, useState } from "react";
import type { ThemeId } from "../lib/themes";
import { THEME_IDS, THEME_LABELS } from "../lib/themes";

interface Props {
  open: boolean;
  theme: ThemeId;
  onTheme: (id: ThemeId) => void;
  onClose: () => void;
}

export function SettingsPanel({ open, theme, onTheme, onClose }: Props) {
  const [section, setSection] = useState<"appearance" | "terminal" | "shortcuts" | "about">(
    "appearance",
  );

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="settings-backdrop" onClick={onClose} role="presentation">
      <div
        className="settings-panel"
        role="dialog"
        aria-label="Settings"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="settings-head">
          <h2>Settings</h2>
          <button type="button" className="chip" onClick={onClose}>
            Close
          </button>
        </header>
        <nav className="settings-nav">
          {(
            [
              ["appearance", "Appearance"],
              ["terminal", "Terminal"],
              ["shortcuts", "Shortcuts"],
              ["about", "About"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              className={section === id ? "chip active" : "chip"}
              onClick={() => setSection(id)}
            >
              {label}
            </button>
          ))}
        </nav>
        <div className="settings-body">
          {section === "appearance" && (
            <label className="settings-row">
              <span>Theme</span>
              <select value={theme} onChange={(e) => onTheme(e.target.value as ThemeId)}>
                {THEME_IDS.map((id) => (
                  <option key={id} value={id}>
                    {THEME_LABELS[id]}
                  </option>
                ))}
              </select>
            </label>
          )}
          {section === "terminal" && (
            <p className="settings-note">
              Command blocks, GPU rendering, search (⌘F), and jump-to-bottom are always on for
              shell panes. Right-click a terminal for copy, paste, clear, and split.
            </p>
          )}
          {section === "shortcuts" && (
            <pre className="help">
{`⌘/Ctrl+T         new workspace tab
⌘/Ctrl+N         new pane
⌘/Ctrl+W         close workspace tab
⌘/Ctrl+1–9       switch workspace tab
⌘/Ctrl+P         quick open file
⌘/Ctrl+D         split focused pane
⌘/Ctrl+F         search in focused terminal
⌘/Ctrl+B         board
⌘/Ctrl+Shift+S   swarm
⌘/Ctrl+S         save template
⌘/Ctrl+,         toggle inspector
⌘/Ctrl+Shift+T   cycle theme
?                shortcut help`}
            </pre>
          )}
          {section === "about" && (
            <p className="settings-note">
              agentgrid is an independent open-source ADE inspired by BridgeSpace. Local only —
              no cloud login, no BridgeMind logos. Data lives in ~/.agentgrid/ and this browser.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
