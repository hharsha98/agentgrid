export type ThemeId =
  | "phosphor"
  | "amber"
  | "contrast"
  | "void"
  | "plasma"
  | "tokyo"
  | "dracula"
  | "synthwave"
  | "carbon"
  | "abyss";

export const THEME_IDS: ThemeId[] = [
  "phosphor",
  "amber",
  "contrast",
  "void",
  "plasma",
  "tokyo",
  "dracula",
  "synthwave",
  "carbon",
  "abyss",
];

export const THEME_LABELS: Record<ThemeId, string> = {
  phosphor: "Phosphor",
  amber: "Amber",
  contrast: "Contrast",
  void: "Void",
  plasma: "Plasma",
  tokyo: "Tokyo",
  dracula: "Dracula",
  synthwave: "Synthwave",
  carbon: "Carbon",
  abyss: "Abyss",
};

const STORAGE_KEY = "agentgrid.theme.v1";

export function isThemeId(value: unknown): value is ThemeId {
  return typeof value === "string" && (THEME_IDS as string[]).includes(value);
}

export function loadTheme(): ThemeId {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (isThemeId(raw)) return raw;
  } catch {
    // ignore
  }
  return "phosphor";
}

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
