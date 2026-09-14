import { accessSync, constants } from "node:fs";
import { delimiter, isAbsolute, join } from "node:path";
import {
  AGENT_SPECS,
  type AgentAvailability,
  type AgentId,
  type AgentSpec,
} from "@agentgrid/shared";

function executableCandidates(command: string): string[] {
  if (process.platform !== "win32") return [command];
  const lower = command.toLowerCase();
  if (lower.endsWith(".exe") || lower.endsWith(".cmd") || lower.endsWith(".bat")) {
    return [command];
  }
  return [command, `${command}.exe`, `${command}.cmd`, `${command}.bat`];
}

function which(command: string): string | null {
  if (isAbsolute(command)) {
    try {
      accessSync(command, constants.X_OK);
      return command;
    } catch {
      return null;
    }
  }

  const pathEnv = process.env.PATH ?? "";
  for (const dir of pathEnv.split(delimiter)) {
    if (!dir) continue;
    for (const name of executableCandidates(command)) {
      const candidate = join(dir, name);
      try {
        accessSync(candidate, constants.X_OK);
        return candidate;
      } catch {
        // try next
      }
    }
  }
  return null;
}

function shellSpec(): AgentSpec {
  if (process.platform === "win32") {
    return {
      ...AGENT_SPECS.shell,
      command: process.env.ComSpec ?? "cmd.exe",
      args: [],
    };
  }
  const fromEnv = process.env.SHELL;
  if (fromEnv && which(fromEnv)) {
    return { ...AGENT_SPECS.shell, command: fromEnv, args: ["-l"] };
  }
  return AGENT_SPECS.shell;
}

/** Resolve the executable + args for an agent, or null if missing. */
export function resolveAgent(agentId: AgentId): {
  spec: AgentSpec;
  resolvedCommand: string;
} | null {
  const spec = agentId === "shell" ? shellSpec() : AGENT_SPECS[agentId];
  const resolvedCommand = which(spec.command);
  if (!resolvedCommand) return null;
  return { spec, resolvedCommand };
}

export function detectAgents(): AgentAvailability[] {
  return (Object.keys(AGENT_SPECS) as AgentId[]).map((id) => {
    const resolved = resolveAgent(id);
    const spec = AGENT_SPECS[id];
    return {
      id,
      displayName: spec.displayName,
      available: resolved !== null,
      command: resolved?.resolvedCommand ?? spec.command,
      installHint: spec.installHint,
    };
  });
}
