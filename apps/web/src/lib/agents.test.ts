import { describe, expect, it } from "vitest";
import { agentOptionLabel, sessionAgentLabel } from "./agents";

describe("agent labels", () => {
  it("marks simulated and missing agents in the picker", () => {
    expect(
      agentOptionLabel({ displayName: "Claude Code", available: true, runtime: "simulated" }),
    ).toBe("Claude Code (simulated)");
    expect(
      agentOptionLabel({ displayName: "Codex", available: false, runtime: "missing" }),
    ).toBe("Codex (missing)");
    expect(agentOptionLabel({ displayName: "Shell", available: true, runtime: "native" })).toBe(
      "Shell",
    );
  });

  it("marks a simulated session in the pane", () => {
    expect(sessionAgentLabel({ agentId: "claude", runtime: "simulated", status: "running" })).toBe(
      "claude · sim",
    );
    expect(sessionAgentLabel({ agentId: "shell", runtime: "native", status: "exited" })).toBe(
      "shell · exited",
    );
  });
});
