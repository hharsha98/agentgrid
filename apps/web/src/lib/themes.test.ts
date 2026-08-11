import { describe, expect, it, beforeEach, afterEach } from "vitest";
import {
  THEME_IDS,
  applyTheme,
  cycleTheme,
  isThemeId,
  loadTheme,
} from "./themes";

function installDomShim() {
  const g = globalThis as Record<string, unknown>;
  const store: Record<string, string> = {};
  g.document = {
    documentElement: { dataset: {} as Record<string, string> },
  };
  g.localStorage = {
    getItem: (k: string) => store[k] ?? null,
    setItem: (k: string, v: string) => {
      store[k] = v;
    },
    removeItem: (k: string) => {
      delete store[k];
    },
  };
}

describe("themes", () => {
  beforeEach(() => {
    installDomShim();
  });

  afterEach(() => {
    const g = globalThis as Record<string, unknown>;
    delete g.document;
    delete g.localStorage;
  });

  it("validates theme ids", () => {
    expect(isThemeId("phosphor")).toBe(true);
    expect(isThemeId("tokyo")).toBe(true);
    expect(isThemeId("neon")).toBe(false);
  });

  it("cycles through the theme list", () => {
    expect(cycleTheme("phosphor")).toBe("amber");
    expect(cycleTheme("abyss")).toBe("phosphor");
  });

  it("applies data-theme and persists", () => {
    applyTheme("amber");
    const doc = (globalThis as { document: { documentElement: { dataset: Record<string, string> } } })
      .document;
    expect(doc.documentElement.dataset.theme).toBe("amber");
    expect(loadTheme()).toBe("amber");
    expect(THEME_IDS.length).toBeGreaterThanOrEqual(10);
  });
});
