import type { AgentId, LayoutPreset } from "@agentgrid/shared";
import { defaultTree, type PaneNode } from "../grid/splitTree";

export type LayoutMode = "preset" | "free";

export const TAB_COLORS = ["green", "amber", "cyan", "violet", "rose", "slate"] as const;
export type TabColor = (typeof TAB_COLORS)[number];

export function nextTabColor(index: number): TabColor {
  return TAB_COLORS[index % TAB_COLORS.length]!;
}

/** One open workspace tab (local ADE — not cloud sync). */
export interface OpenWorkspace {
  id: string;
  name: string;
  color: TabColor;
  sessionIds: string[];
  layout: LayoutPreset;
  layoutMode: LayoutMode;
  splitTree: PaneNode;
  cwd: string;
  agentId: AgentId;
  activeId: string | null;
}

const OPEN_KEY = "agentgrid.openWorkspaces.v1";

export function newWorkspaceId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `ws-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function createEmptyWorkspace(
  name = "Workspace",
  seed?: Partial<OpenWorkspace>,
): OpenWorkspace {
  return {
    id: seed?.id ?? newWorkspaceId(),
    name: seed?.name ?? name,
    color: seed?.color ?? nextTabColor(0),
    sessionIds: seed?.sessionIds ?? [],
    layout: seed?.layout ?? 1,
    layoutMode: seed?.layoutMode ?? "preset",
    splitTree: seed?.splitTree ?? defaultTree([]),
    cwd: seed?.cwd ?? "",
    agentId: seed?.agentId ?? "shell",
    activeId: seed?.activeId ?? null,
  };
}

export function loadOpenWorkspaces(fallbackName: string): {
  tabs: OpenWorkspace[];
  activeId: string;
} {
  try {
    const raw = localStorage.getItem(OPEN_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as {
        tabs?: OpenWorkspace[];
        activeId?: string;
      };
      if (parsed.tabs?.length) {
        const tabs = parsed.tabs.map((t, i) => ({
          ...t,
          color: t.color ?? nextTabColor(i),
        }));
        const activeId =
          parsed.activeId && tabs.some((t) => t.id === parsed.activeId)
            ? parsed.activeId
            : tabs[0]!.id;
        return { tabs, activeId };
      }
    }
  } catch {
    // ignore
  }
  const first = createEmptyWorkspace(fallbackName || "Workspace");
  return { tabs: [first], activeId: first.id };
}

export function saveOpenWorkspaces(tabs: OpenWorkspace[], activeId: string): void {
  try {
    localStorage.setItem(OPEN_KEY, JSON.stringify({ tabs, activeId }));
  } catch {
    // ignore
  }
}
