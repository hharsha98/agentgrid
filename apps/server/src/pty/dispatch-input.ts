import type { AgentId } from "@agentgrid/shared";

/**
 * Text dumped into a newly spawned PTY for kanban / swarm / skills.
 *
 * Agent CLIs treat stdin as a user prompt. A login shell treats stdin as
 * commands — sending the card title as-is would try to execute it and fail.
 */
export function formatInitialInput(agentId: AgentId, text: string): string {
  const trimmed = text.replace(/\s+$/u, "");
  if (!trimmed) return "";
  if (agentId === "shell") {
    const token = heredocToken(trimmed);
    return `cat <<'${token}'\n${trimmed}\n${token}\n`;
  }
  return `${trimmed}\n`;
}

function heredocToken(text: string): string {
  let token = "AGENTGRID_TASK";
  let i = 0;
  while (text.includes(token)) {
    i += 1;
    token = `AGENTGRID_TASK_${i}`;
  }
  return token;
}
