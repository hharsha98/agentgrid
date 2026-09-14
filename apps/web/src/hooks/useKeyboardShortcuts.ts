import { useEffect } from "react";
import type { LayoutPreset } from "@agentgrid/shared";

export function isEditableTarget(target: EventTarget | null): boolean {
  if (!target || typeof target !== "object") return false;
  const el = target as HTMLElement;
  if (typeof el.tagName !== "string") return false;
  if (el.isContentEditable) return true;
  const tag = el.tagName.toUpperCase();
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  if (typeof el.closest === "function") {
    return Boolean(el.closest(".monaco-editor, .files-monaco, textarea"));
  }
  return false;
}

export interface ShortcutHandlers {
  onLayout?: (layout: LayoutPreset) => void;
  onLaunchPane?: () => void;
  onSaveWorkspace?: () => void;
  onToggleHelp?: () => void;
  onFocusNext?: () => void;
  onFocusPrev?: () => void;
  onCycleTheme?: () => void;
}

/**
 * Keyboard shortcuts (macOS-friendly: Meta, also Ctrl).
 * All of these are skipped while typing in inputs, textareas, or Monaco
 * so Cmd+S in the Files editor does not save a workspace template.
 *
 * - Meta/Ctrl+1|2|4|0 → layout (0 = 16)
 * - Meta/Ctrl+Enter  → launch pane
 * - Meta/Ctrl+S      → save workspace template
 * - Meta/Ctrl+] / [  → next / previous session
 * - Meta/Ctrl+Shift+T → cycle theme
 * - ?                → toggle help (when not typing)
 */
export function useKeyboardShortcuts(handlers: ShortcutHandlers): void {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isEditableTarget(e.target)) return;

      const mod = e.metaKey || e.ctrlKey;

      if (!mod && e.key === "?") {
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
      } else if (e.key === "0") {
        e.preventDefault();
        handlers.onLayout?.(16);
      } else if (e.key === "Enter") {
        e.preventDefault();
        handlers.onLaunchPane?.();
      } else if (e.key.toLowerCase() === "s" && !e.shiftKey) {
        e.preventDefault();
        handlers.onSaveWorkspace?.();
      } else if (e.key.toLowerCase() === "t" && e.shiftKey) {
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
