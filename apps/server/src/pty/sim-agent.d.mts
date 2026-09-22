export function profile(agentId: string): { name: string; voice: string };
export function banner(agentId: string): string;
export function simulateReply(agentId: string, text: string): string;
export function helpText(): string;
export function classifyCommand(text: string): "exit" | "fail" | "help" | "prompt";
