#!/usr/bin/env node
/**
 * Native smoke: boot the Fastify server (no Docker) with DEMO_PUBLIC and
 * exercise health, a real shell PTY, a simulated agent pane, and kanban dispatch.
 */
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const serverDir = join(root, "apps/server");
const tsxCli = createRequire(join(serverDir, "package.json")).resolve("tsx/cli");

function freePort() {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.listen(0, "127.0.0.1", () => {
      const addr = server.address();
      const port = typeof addr === "object" && addr ? addr.port : 0;
      server.close((err) => (err ? reject(err) : resolve(port)));
    });
  });
}

async function waitHealth(port, child) {
  const deadline = Date.now() + 25000;
  let last = "";
  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(`server exited ${child.exitCode} before health`);
    }
    try {
      const res = await fetch(`http://127.0.0.1:${port}/api/health`);
      if (res.ok) return;
      last = `HTTP ${res.status}`;
    } catch (err) {
      last = err instanceof Error ? err.message : String(err);
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`timed out waiting for health (${last})`);
}

function wsRoundtrip(url, onMessage) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url);
    const timer = setTimeout(() => {
      ws.close();
      reject(new Error(`websocket timeout ${url}`));
    }, 15000);
    ws.addEventListener("message", (ev) => {
      try {
        const done = onMessage(JSON.parse(String(ev.data)), (data) => {
          ws.send(JSON.stringify(data));
        });
        if (done) {
          clearTimeout(timer);
          ws.close();
          resolve();
        }
      } catch (err) {
        clearTimeout(timer);
        ws.close();
        reject(err);
      }
    });
    ws.addEventListener("error", () => {
      clearTimeout(timer);
      reject(new Error(`websocket error ${url}`));
    });
  });
}

const port = await freePort();
const home = mkdtempSync(join(tmpdir(), "agentgrid-smoke-"));
const logs = [];
const child = spawn(process.execPath, [tsxCli, "src/index.ts"], {
  cwd: serverDir,
  env: {
    ...process.env,
    DEMO_PUBLIC: "1",
    PORT: String(port),
    HOME: home,
    USERPROFILE: home,
  },
  stdio: ["ignore", "pipe", "pipe"],
});
child.stdout.on("data", (chunk) => logs.push(String(chunk)));
child.stderr.on("data", (chunk) => logs.push(String(chunk)));

try {
  await waitHealth(port, child);
  const base = `http://127.0.0.1:${port}`;

  const settingsRes = await fetch(`${base}/api/settings`);
  if (!settingsRes.ok) throw new Error(`settings ${settingsRes.status}`);
  const settings = await settingsRes.json();
  if (settings.studio?.live !== false || settings.studio?.publicUrl !== null) {
    throw new Error("studio.live must stay false and publicUrl null");
  }
  if (settings.demo?.public !== true) throw new Error("expected demo.public");

  const agents = await (await fetch(`${base}/api/agents`)).json();
  const claude = agents.agents.find((agent) => agent.id === "claude");
  const shellAgent = agents.agents.find((agent) => agent.id === "shell");
  if (!shellAgent?.available || shellAgent.runtime !== "native") {
    throw new Error("shell must be a native PTY");
  }
  if (!claude?.available) throw new Error("claude must be launchable under DEMO_PUBLIC");

  const shellCreate = await fetch(`${base}/api/sessions`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ agentId: "shell", title: "smoke-shell", cwd: root }),
  });
  if (shellCreate.status !== 201) {
    throw new Error(`shell create ${shellCreate.status} ${await shellCreate.text()}`);
  }
  const shellId = (await shellCreate.json()).session.id;
  let shellBuf = "";
  await wsRoundtrip(`ws://127.0.0.1:${port}/api/sessions/${shellId}/ws`, (msg, send) => {
    if (msg.type === "ready") send({ type: "input", data: "printf 'agentgrid-smoke-ok\\n'\n" });
    if (msg.type === "output") shellBuf += msg.data ?? "";
    return shellBuf.includes("agentgrid-smoke-ok");
  });
  await fetch(`${base}/api/sessions/${shellId}`, { method: "DELETE" });

  if (claude.runtime === "simulated") {
    const simCreate = await fetch(`${base}/api/sessions`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ agentId: "claude", title: "smoke-sim", cwd: root }),
    });
    if (simCreate.status !== 201) {
      throw new Error(`sim create ${simCreate.status} ${await simCreate.text()}`);
    }
    const simBody = await simCreate.json();
    if (simBody.session.runtime !== "simulated") throw new Error("expected simulated runtime");
    let simBuf = "";
    let asked = false;
    await wsRoundtrip(`ws://127.0.0.1:${port}/api/sessions/${simBody.session.id}/ws`, (msg, send) => {
      if (msg.type === "output") simBuf += msg.data ?? "";
      if (simBuf.includes("agentgrid-sim-ready") && !asked) {
        asked = true;
        send({ type: "input", data: "hello grid\n" });
      }
      return simBuf.includes("agentgrid-sim-reply") && simBuf.includes("hello grid");
    });
    await fetch(`${base}/api/sessions/${simBody.session.id}`, { method: "DELETE" });
  }

  const board = await (await fetch(`${base}/api/kanban`)).json();
  if (!Array.isArray(board.cards) || board.cards.length < 3) {
    throw new Error("expected the empty-board demo seed (3 cards)");
  }
  const card = board.cards.find((item) => item.column === "todo") ?? board.cards[0];
  const dispatch = await fetch(`${base}/api/kanban/cards/${card.id}/dispatch`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ cwd: root }),
  });
  if (dispatch.status !== 201) {
    throw new Error(`dispatch ${dispatch.status} ${await dispatch.text()}`);
  }
  const dispatched = await dispatch.json();
  if (dispatched.card?.column !== "in_progress" || !dispatched.session?.id) {
    throw new Error("dispatch did not open a session");
  }
  await fetch(`${base}/api/sessions/${dispatched.session.id}`, { method: "DELETE" });

  console.log(
    `smoke ok on 127.0.0.1:${port} — shell native, claude ${claude.runtime}, kanban dispatch 201`,
  );
} catch (err) {
  const tail = logs.join("").slice(-4000);
  if (tail.trim()) console.error(tail);
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
} finally {
  child.kill("SIGTERM");
  await Promise.race([
    new Promise((resolve) => child.once("exit", resolve)),
    new Promise((resolve) =>
      setTimeout(() => {
        child.kill("SIGKILL");
        resolve();
      }, 2000),
    ),
  ]);
  rmSync(home, { recursive: true, force: true });
}

if (process.exitCode) process.exit(process.exitCode);
