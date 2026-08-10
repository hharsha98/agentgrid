export type ThemeId = "phosphor" | "amber" | "contrast";

export const THEME_IDS: ThemeId[] = ["phosphor", "amber", "contrast"];

export const THEME_LABELS: Record<ThemeId, string> = {
  phosphor: "Phosphor",
  amber: "Amber",
  contrast: "Contrast",
};

const STORAGE_KEY = "agentgrid.theme.v1";

export function isThemeId(value: unknown): value is ThemeId {
  return value === "phosphor" || value === "amber" || value === "contrast";
}

/** Read saved theme from the browser (localStorage = small key/value store). */
export function loadTheme(): ThemeId {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (isThemeId(raw)) return raw;
  } catch {
    // ignore quota / private mode
  }
  return "phosphor";
}

/** Apply CSS theme tokens via data-theme and remember the choice. */
export function applyTheme(id: ThemeId): void {
  document.documentElement.dataset.theme = id;
  try {
    localStorage.setItem(STORAGE_KEY, id);
  } catch {
    // ignore
  }
}

export function cycleTheme(current: ThemeId): ThemeId {
  const idx = THEME_IDS.indexOf(current);
  return THEME_IDS[(idx + 1) % THEME_IDS.length]!;
}

/** Pull live CSS variables so xterm matches the UI chrome. */
export function readXtermTheme(): {
  background: string;
  foreground: string;
  cursor: string;
  selectionBackground: string;
} {
  const styles = getComputedStyle(document.documentElement);
  const get = (name: string, fallback: string) =>
    styles.getPropertyValue(name).trim() || fallback;
  return {
    background: get("--bg-pane", "#0a0f0d"),
    foreground: get("--ink", "#e8f0eb"),
    cursor: get("--accent", "#3dcf8e"),
    selectionBackground: get("--accent-dim", "#1a5c3f"),
  };
}
