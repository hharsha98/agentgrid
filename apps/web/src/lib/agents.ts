import type { AgentAvailability, SessionInfo } from "@agentgrid/shared";

export function agentOptionLabel(
  agent: Pick<AgentAvailability, "displayName" | "available"> & { runtime?: AgentAvailability["runtime"] },
): string {
  if (agent.runtime === "simulated") return `${agent.displayName} (simulated)`;
  if (!agent.available || agent.runtime === "missing") return `${agent.displayName} (missing)`;
  return agent.displayName;
}

export function sessionAgentLabel(
  session: Pick<SessionInfo, "agentId" | "runtime" | "status">,
): string {
  const bits: string[] = [session.agentId];
  if (session.runtime === "simulated") bits.push("sim");
  if (session.status === "exited") bits.push("exited");
  return bits.join(" · ");
}
