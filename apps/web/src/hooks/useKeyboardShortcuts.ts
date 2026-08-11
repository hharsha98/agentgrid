import { useEffect } from "react";
import type { LayoutPreset } from "@agentgrid/shared";

export interface ShortcutHandlers {
  onLayout?: (layout: LayoutPreset) => void;
  onLaunchPane?: () => void;
  onSaveWorkspace?: () => void;
  onToggleHelp?: () => void;
  onFocusNext?: () => void;
  onFocusPrev?: () => void;
  onCycleTheme?: () => void;
  onNewPane?: () => void;
  onSplit?: () => void;
  onToggleBoard?: () => void;
  onToggleSwarm?: () => void;
  onToggleInspector?: () => void;
}

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target.isContentEditable;
}

/**
 * Keyboard shortcuts (macOS-friendly: Meta, also Ctrl):
 * - Meta/Ctrl+N → new pane
 * - Meta/Ctrl+D → split focused (free mode)
 * - Meta/Ctrl+B → toggle board
 * - Meta/Ctrl+Shift+S → toggle swarm
 * - Meta/Ctrl+, → toggle inspector
 * - Meta/Ctrl+1|2|4|0 → layout (0 = 16)
 * - Meta/Ctrl+Enter → launch pane
 * - Meta/Ctrl+S → save workspace template
 * - Meta/Ctrl+] / [ → next / previous session
 * - Meta/Ctrl+Shift+T → cycle theme
 * - ? → toggle help (when not typing)
 */
export function useKeyboardShortcuts(handlers: ShortcutHandlers): void {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;

      if (!mod && e.key === "?" && !isTypingTarget(e.target)) {
        e.preventDefault();
        handlers.onToggleHelp?.();
        return;
      }

      if (!mod) return;

      const key = e.key.toLowerCase();

      if (key === "n" && !e.shiftKey) {
        e.preventDefault();
        handlers.onNewPane?.();
      } else if (key === "d" && !e.shiftKey) {
        e.preventDefault();
        handlers.onSplit?.();
      } else if (key === "b" && !e.shiftKey) {
        e.preventDefault();
        handlers.onToggleBoard?.();
      } else if (key === "s" && e.shiftKey) {
        e.preventDefault();
        handlers.onToggleSwarm?.();
      } else if (e.key === ",") {
        e.preventDefault();
        handlers.onToggleInspector?.();
      } else if (e.key === "1") {
        e.preventDefault();
        handlers.onLayout?.(1);
      } else if (e.key === "2") {
        e.preventDefault();
        handlers.onLayout?.(2);
      } else if (e.key === "4") {
        e.preventDefault();
        handlers.onLayout?.(4);
      } else if (e.key === "0") {
        e.preventDefault();
        handlers.onLayout?.(16);
      } else if (e.key === "Enter") {
        e.preventDefault();
        handlers.onLaunchPane?.();
      } else if (key === "s" && !e.shiftKey) {
        e.preventDefault();
        handlers.onSaveWorkspace?.();
      } else if (key === "t" && e.shiftKey) {
        e.preventDefault();
        handlers.onCycleTheme?.();
      } else if (e.key === "]") {
        e.preventDefault();
        handlers.onFocusNext?.();
      } else if (e.key === "[") {
        e.preventDefault();
        handlers.onFocusPrev?.();
      }
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [handlers]);
}
