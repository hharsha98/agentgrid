import { describe, expect, it } from "vitest";
import { isEditableTarget } from "./useKeyboardShortcuts";

function el(tag: string, attrs: Record<string, string> = {}, parent?: HTMLElement): HTMLElement {
  const node = {
    tagName: tag.toUpperCase(),
    isContentEditable: attrs.contentEditable === "true",
    closest(selector: string) {
      if (selector.includes("textarea") && tag.toUpperCase() === "TEXTAREA") return node;
      if (selector.includes("monaco") && attrs.className?.includes("monaco")) return node;
      return parent?.closest?.(selector) ?? null;
    },
  };
  return node as unknown as HTMLElement;
}

describe("isEditableTarget", () => {
  it("treats form fields and monaco as editable", () => {
    expect(isEditableTarget(el("input"))).toBe(true);
    expect(isEditableTarget(el("textarea"))).toBe(true);
    expect(isEditableTarget(el("select"))).toBe(true);
    expect(isEditableTarget(el("div", { className: "monaco-editor" }))).toBe(true);
    expect(isEditableTarget(el("button"))).toBe(false);
    expect(isEditableTarget(null)).toBe(false);
  });
});
