import { useEffect } from "react";
import type { LayoutPreset } from "@agentgrid/shared";

export interface ShortcutHandlers {
  onLayout?: (layout: LayoutPreset) => void;
  onLaunchPane?: () => void;
  onSaveWorkspace?: () => void;
  onToggleHelp?: () => void;
  onFocusNext?: () => void;
  onFocusPrev?: () => void;
}

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target.isContentEditable;
}

/**
 * Keyboard shortcuts (macOS-friendly: Meta, also Ctrl):
 * - Meta/Ctrl+1|2|4  → layout
 * - Meta/Ctrl+Enter  → launch pane
 * - Meta/Ctrl+S      → save workspace template
 * - Meta/Ctrl+] / [  → next / previous session
 * - ?                → toggle help (when not typing)
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

      if (e.key === "1") {
        e.preventDefault();
        handlers.onLayout?.(1);
      } else if (e.key === "2") {
        e.preventDefault();
        handlers.onLayout?.(2);
      } else if (e.key === "4") {
        e.preventDefault();
        handlers.onLayout?.(4);
      } else if (e.key === "Enter") {
        e.preventDefault();
        handlers.onLaunchPane?.();
      } else if (e.key.toLowerCase() === "s") {
        e.preventDefault();
        handlers.onSaveWorkspace?.();
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
