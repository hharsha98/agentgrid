/**
 * Local DEMO_PUBLIC stand-in for a missing vendor CLI.
 * Spawned under a real PTY. It does not call a model or the network.
 *
 *   node sim-agent.mjs <agentId>
 */

import { createInterface } from "node:readline";

const PROFILES = {
  claude: {
    name: "Claude Code",
    voice: "I will outline the change and stop before editing the repo.",
  },
  "cursor-agent": {
    name: "Cursor Agent",
    voice: "I will name the files a Cursor agent would open next, as text only.",
  },
  codex: {
    name: "Codex",
    voice: "I will sketch a patch as text. Nothing is applied.",
  },
  gemini: {
    name: "Gemini CLI",
    voice: "I will summarize the note and list what is still open.",
  },
};

export function profile(agentId) {
  return (
    PROFILES[agentId] ?? {
      name: agentId,
      voice: "I will answer as a local stand-in only.",
    }
  );
}

export function banner(agentId) {
  const p = profile(agentId);
  return [
    "agentgrid-sim-ready",
    "agentgrid DEMO_PUBLIC",
    `${p.name} — local simulator`,
    "This process is not the vendor CLI. It does not call a model or the network.",
    "Type a prompt. `exit` closes the pane (code 0 → kanban Done). `/help` lists commands.",
    "",
  ].join("\n");
}

export function simulateReply(agentId, text) {
  const p = profile(agentId);
  const clipped = String(text ?? "").trim().slice(0, 800);
  const hints = contextualHints(clipped);
  return [
    "agentgrid-sim-reply",
    `[${p.name} · simulated]`,
    p.voice,
    "",
    "You wrote:",
    clipped || "(empty)",
    "",
    ...hints,
    "Nothing was sent to a model and no files were changed.",
  ].join("\n");
}

export function helpText() {
  return [
    "agentgrid-sim-help",
    "Commands:",
    "  /help   show this list",
    "  exit    close the pane with code 0 (kanban card → Done)",
    "  fail    close the pane with code 1 (kanban card → In Review)",
    "Any other text gets a local simulated reply.",
  ].join("\n");
}

function contextualHints(text) {
  const t = text.toLowerCase();
  const lines = [];
  if (t.includes("layout") || t.includes("pane") || t.includes("grid") || t.includes("focus")) {
    lines.push(
      "Presets: 1, 2, 4, 6, 8, 12, 16. Free mode splits a pane with H/V. ⌘/Ctrl+[ ] moves focus.",
    );
  }
  if (t.includes("kanban") || t.includes("dispatch") || t.includes("card") || t.includes("shell")) {
    lines.push(
      "Dispatch opens a pane and writes the card. A shell card is shown with a heredoc so the title is not executed.",
    );
  }
  if (t.includes("swarm") || t.includes("mission") || t.includes("mailbox")) {
    lines.push(
      "A swarm opens four PTY panes (coordinator, builder, scout, reviewer) and stores mail, plan, and claims as local JSON.",
    );
  }
  if (t.includes("demo") || t.includes("simulat") || t.includes("path") || t.includes("cli")) {
    lines.push(
      "DEMO_PUBLIC only fills in CLIs that are missing. If `claude` (or the others) is on PATH, that pane is the real program.",
    );
  }
  if (lines.length === 0) {
    lines.push(
      "Local stand-in only. Install the real CLI and restart without relying on the simulator when you want vendor behavior.",
    );
  }
  return lines;
}

export function classifyCommand(text) {
  const trimmed = String(text ?? "").trim();
  if (/^(exit|quit|\/exit)$/i.test(trimmed)) return "exit";
  if (/^(fail|\/fail)$/i.test(trimmed)) return "fail";
  if (/^\/help$/i.test(trimmed)) return "help";
  return "prompt";
}

function startRepl(agentId) {
  process.stdout.write(`${banner(agentId)}\n`);
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: Boolean(process.stdin.isTTY),
    prompt: `${agentId}> `,
  });

  let buffer = [];
  let timer = null;
  let stopping = false;

  const stop = (code) => {
    if (stopping) return;
    stopping = true;
    if (timer) clearTimeout(timer);
    process.exit(code);
  };

  const flush = () => {
    timer = null;
    const text = buffer.join("\n").trim();
    buffer = [];
    if (!text) {
      rl.prompt();
      return;
    }
    const kind = classifyCommand(text);
    if (kind === "exit") {
      process.stdout.write("agentgrid-sim-exit 0\n");
      stop(0);
      return;
    }
    if (kind === "fail") {
      process.stdout.write("agentgrid-sim-exit 1\n");
      stop(1);
      return;
    }
    const body = kind === "help" ? helpText() : simulateReply(agentId, text);
    process.stdout.write(`${body}\n`);
    rl.prompt();
  };

  rl.on("line", (line) => {
    buffer.push(line);
    if (timer) clearTimeout(timer);
    // Group a multi-line paste (kanban title + body) into one reply.
    timer = setTimeout(flush, 60);
  });

  rl.on("close", () => {
    if (stopping) return;
    if (timer) {
      clearTimeout(timer);
      timer = null;
      const text = buffer.join("\n").trim();
      buffer = [];
      const kind = classifyCommand(text);
      if (kind === "fail") {
        process.stdout.write("agentgrid-sim-exit 1\n");
        stop(1);
        return;
      }
      if (kind === "exit") {
        process.stdout.write("agentgrid-sim-exit 0\n");
        stop(0);
        return;
      }
    }
    stop(0);
  });

  rl.prompt();
}

const invokedDirectly =
  process.argv[1] &&
  (process.argv[1].endsWith("sim-agent.mjs") || process.argv[1].endsWith("sim-agent.mjs/"));

if (invokedDirectly) {
  const agentId = process.argv[2] || "claude";
  startRepl(agentId);
}
