import { describe, expect, it, afterEach } from "vitest";
import { apiUrl, isTauriShell, wsSessionUrl } from "./http";

describe("http helpers", () => {
  afterEach(() => {
    const g = globalThis as Record<string, unknown>;
    delete g.__TAURI_INTERNALS__;
    delete g.window;
  });

  it("uses relative paths in the browser", () => {
    expect(isTauriShell()).toBe(false);
    expect(apiUrl("/api/health")).toBe("/api/health");
    expect(wsSessionUrl("abc")).toContain("/api/sessions/abc/ws");
  });

  it("points at the local server inside Tauri", () => {
    const g = globalThis as Record<string, unknown>;
    // Vitest node env has no DOM window — fake one for the Tauri detect path.
    g.window = g;
    g.__TAURI_INTERNALS__ = {};
    expect(isTauriShell()).toBe(true);
    expect(apiUrl("/api/health")).toBe("http://127.0.0.1:4318/api/health");
    expect(wsSessionUrl("abc")).toBe("ws://127.0.0.1:4318/api/sessions/abc/ws");
  });
});
