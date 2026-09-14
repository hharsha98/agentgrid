import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { AgentSpec } from "@agentgrid/shared";

function integrationDir(): string {
  return join(dirname(fileURLToPath(import.meta.url)), "../../shell-integration");
}

function shellName(command: string): string {
  return basename(command).toLowerCase();
}

/** OSC 133 hooks without touching the user's own dotfiles. */
export function shellIntegration(
  spec: AgentSpec,
): { extraEnv: Record<string, string>; args: string[] } {
  const integ = integrationDir();
  const name = shellName(spec.command);
  if (name === "zsh") {
    return { extraEnv: { ZDOTDIR: integ }, args: spec.args.length ? spec.args : ["-l"] };
  }
  if (name === "bash") {
    return { extraEnv: {}, args: ["--rcfile", join(integ, "bashrc")] };
  }
  return { extraEnv: {}, args: spec.args };
}
