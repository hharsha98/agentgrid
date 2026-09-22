import { describe, expect, it } from "vitest";
import { sameSessions } from "./sessions";
import type { SessionInfo } from "@agentgrid/shared";

function session(partial: Partial<SessionInfo> & { id: string }): SessionInfo {
  return {
    agentId: "shell",
    cwd: "/tmp",
    cols: 80,
    rows: 24,
    createdAt: "2026-01-01T00:00:00.000Z",
    title: "t",
    status: "running",
    ...partial,
  };
}

describe("sameSessions", () => {
  it("is true for identical snapshots and false when a pane exits", () => {
    const a = [session({ id: "1" })];
    expect(sameSessions(a, [session({ id: "1" })])).toBe(true);
    expect(sameSessions(a, [session({ id: "1", status: "exited" })])).toBe(false);
    expect(sameSessions(a, [session({ id: "2" })])).toBe(false);
    expect(sameSessions(a, [session({ id: "1", runtime: "simulated" })])).toBe(false);
  });
});
