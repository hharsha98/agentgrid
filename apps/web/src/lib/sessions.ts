import type { SessionInfo } from "@agentgrid/shared";

/** Avoid React re-renders (and free-layout refill) when the poll returns the same snapshot. */
export function sameSessions(a: SessionInfo[], b: SessionInfo[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((s, i) => {
    const other = b[i];
    return (
      other !== undefined &&
      s.id === other.id &&
      s.title === other.title &&
      s.agentId === other.agentId &&
      (s.status ?? "running") === (other.status ?? "running") &&
      (s.exitCode ?? null) === (other.exitCode ?? null)
    );
  });
}
