import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { banner, classifyCommand, simulateReply } from "./sim-agent.mjs";

describe("sim-agent", () => {
  it("banners as a local simulator, not a vendor CLI", () => {
    const text = banner("claude");
    expect(text).toContain("agentgrid-sim-ready");
    expect(text).toContain("local simulator");
    expect(text).toContain("does not call a model");
  });

  it("replies with the operator text and a grid hint", () => {
    const text = simulateReply("cursor-agent", "Sketch a four-pane layout");
    expect(text).toContain("agentgrid-sim-reply");
    expect(text).toContain("Sketch a four-pane layout");
    expect(text).toContain("simulated");
    expect(text).toContain("Presets:");
    expect(text).toContain("no files were changed");
  });

  it("classifies exit, fail, and help", () => {
    expect(classifyCommand("exit")).toBe("exit");
    expect(classifyCommand("/fail")).toBe("fail");
    expect(classifyCommand("/help")).toBe("help");
    expect(classifyCommand("ship the grid")).toBe("prompt");
  });

  it("exits 0 for exit and 1 for fail", async () => {
    const script = fileURLToPath(new URL("./sim-agent.mjs", import.meta.url));
    const run = (input: string) =>
      new Promise<number | null>((resolve, reject) => {
        const child = spawn(process.execPath, [script, "claude"], {
          stdio: ["pipe", "ignore", "ignore"],
        });
        child.on("error", reject);
        child.on("exit", (code) => resolve(code));
        child.stdin.write(input);
        child.stdin.end();
      });
    expect(await run("exit\n")).toBe(0);
    expect(await run("fail\n")).toBe(1);
  });
});
