import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { RingBuffer } from "./ring-buffer.js";
import { detectAgents, resolveAgent } from "./agents.js";
import { shellIntegration } from "./shell-integration.js";
import { SessionManager } from "./session-manager.js";
import { AGENT_SPECS } from "@agentgrid/shared";

describe("RingBuffer", () => {
  it("stores and returns written bytes", () => {
    const rb = new RingBuffer(64);
    rb.write("hello");
    expect(rb.toString()).toBe("hello");
    expect(rb.byteLength).toBe(5);
  });

  it("drops oldest bytes when over capacity", () => {
    const rb = new RingBuffer(8);
    rb.write("abcdefghij"); // 10 bytes into 8
    expect(rb.byteLength).toBe(8);
    expect(rb.toString()).toBe("cdefghij");
  });
});

describe("agents", () => {
  it("detects shell as available", () => {
    const agents = detectAgents();
    const shell = agents.find((a) => a.id === "shell");
    expect(shell?.available).toBe(true);
  });

  it("resolves shell", () => {
    expect(resolveAgent("shell")).not.toBeNull();
  });

  it("points zsh at ZDOTDIR/.zshrc and bash at --rcfile without editing user dotfiles", () => {
    const zsh = shellIntegration({ ...AGENT_SPECS.shell, command: "/bin/zsh", args: ["-l"] });
    expect(zsh.extraEnv.ZDOTDIR).toMatch(/shell-integration$/);
    expect(existsSync(`${zsh.extraEnv.ZDOTDIR}/.zshrc`)).toBe(true);
    const bash = shellIntegration({ ...AGENT_SPECS.shell, command: "/bin/bash", args: ["-l"] });
    expect(bash.args[0]).toBe("--rcfile");
    expect(bash.args[1]).toMatch(/bashrc$/);
    expect(existsSync(bash.args[1]!)).toBe(true);
  });
});

describe("SessionManager I/O", () => {
  it("writes to a live PTY and delivers output to subscribers", async () => {
    const mgr = new SessionManager();
    const info = mgr.create({ agentId: "shell", title: "io" });
    const chunks: string[] = [];
    try {
      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error("pty subscribe timeout")), 8000);
        mgr.subscribe(info.id, (data) => {
          chunks.push(data);
          if (chunks.join("").includes("agentgrid-pty-ok")) {
            clearTimeout(timer);
            resolve();
          }
        });
        mgr.write(info.id, "printf 'agentgrid-pty-ok\\n'\n");
      });
    } finally {
      mgr.dispose(info.id);
    }
    expect(chunks.join("")).toContain("agentgrid-pty-ok");
  }, 10000);

  it("replays exit to a late subscriber", async () => {
    const mgr = new SessionManager();
    const info = mgr.create({ agentId: "shell", title: "late" });
    mgr.write(info.id, "exit\n");
    for (let i = 0; i < 40; i++) {
      if (mgr.get(info.id)?.status === "exited") break;
      await new Promise((r) => setTimeout(r, 50));
    }
    expect(mgr.get(info.id)?.status).toBe("exited");
    let exitCode: number | null | undefined;
    mgr.subscribe(info.id, () => undefined, (code) => {
      exitCode = code;
    });
    expect(exitCode).not.toBeUndefined();
    expect(mgr.write(info.id, "echo no\n")).toBe(false);
    mgr.dispose(info.id);
  }, 10000);
});
