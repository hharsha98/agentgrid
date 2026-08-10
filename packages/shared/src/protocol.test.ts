import { describe, expect, it } from "vitest";
import {
  AGENT_SPECS,
  DEFAULT_SERVER_PORT,
  DEFAULT_WEB_PORT,
  isAgentId,
} from "./protocol.js";

describe("protocol", () => {
  it("lists the four built-in agents", () => {
    expect(Object.keys(AGENT_SPECS).sort()).toEqual([
      "claude",
      "codex",
      "cursor-agent",
      "shell",
    ]);
  });

  it("uses ports that do not collide with vibedeck", () => {
    expect(DEFAULT_SERVER_PORT).toBe(4318);
    expect(DEFAULT_WEB_PORT).toBe(5318);
    expect(DEFAULT_SERVER_PORT).not.toBe(4317);
    expect(DEFAULT_WEB_PORT).not.toBe(5317);
  });

  it("type-guards agent ids", () => {
    expect(isAgentId("claude")).toBe(true);
    expect(isAgentId("nope")).toBe(false);
  });
});
