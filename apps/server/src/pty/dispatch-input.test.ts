import { describe, expect, it } from "vitest";
import { formatInitialInput } from "./dispatch-input.js";

describe("formatInitialInput", () => {
  it("wraps shell payloads in a heredoc so the title is not executed", () => {
    const out = formatInitialInput("shell", "Run echo\n\nprint hello");
    expect(out.startsWith("cat <<'AGENTGRID_TASK'\n")).toBe(true);
    expect(out).toContain("Run echo");
    expect(out).toContain("print hello");
    expect(out.endsWith("AGENTGRID_TASK\n")).toBe(true);
    expect(out.split("\n")[0]).not.toBe("Run echo");
  });

  it("avoids colliding with the payload's own delimiter", () => {
    const out = formatInitialInput("shell", "see AGENTGRID_TASK inside");
    expect(out.startsWith("cat <<'AGENTGRID_TASK_1'\n")).toBe(true);
  });

  it("sends agent prompts as plain text with a trailing newline", () => {
    expect(formatInitialInput("claude", "Fix the login bug")).toBe("Fix the login bug\n");
    expect(formatInitialInput("cursor-agent", "already\n")).toBe("already\n");
  });

  it("returns empty for blank input", () => {
    expect(formatInitialInput("shell", "  \n")).toBe("");
  });
});
