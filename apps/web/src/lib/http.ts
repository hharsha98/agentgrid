import { DEFAULT_SERVER_PORT } from "@agentgrid/shared";

/** True when running inside the Tauri desktop shell (not the browser). */
export function isTauriShell(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

/**
 * Browser uses Vite's /api proxy. Desktop loads static files, so talk to
 * the Fastify server on 4318 directly.
 */
export function apiUrl(path: string): string {
  if (!path.startsWith("/")) return path;
  if (isTauriShell()) return `http://127.0.0.1:${DEFAULT_SERVER_PORT}${path}`;
  return path;
}

export function wsSessionUrl(sessionId: string): string {
  if (isTauriShell()) {
    return `ws://127.0.0.1:${DEFAULT_SERVER_PORT}/api/sessions/${sessionId}/ws`;
  }
  // Node/unit tests have no DOM location — fall back to same-origin style host.
  const loc = typeof window !== "undefined" ? window.location : undefined;
  const proto = loc?.protocol === "https:" ? "wss:" : "ws:";
  const host = loc?.host || `127.0.0.1:${DEFAULT_SERVER_PORT}`;
  return `${proto}//${host}/api/sessions/${sessionId}/ws`;
}

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(apiUrl(path), {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = (await res.json()) as { error?: string; installHint?: string };
      detail = body.installHint
        ? `${body.error ?? detail}\n${body.installHint}`
        : (body.error ?? detail);
    } catch {
      // ignore
    }
    throw new Error(detail);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}
