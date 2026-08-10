/** Shared protocol between the Fastify server and the React web app. */

export type AgentId = "claude" | "cursor-agent" | "codex" | "gemini" | "shell";

export interface AgentSpec {
  id: AgentId;
  displayName: string;
  /** Binary name (or absolute path for shell). */
  command: string;
  args: string[];
  /** Shown when the binary is missing from PATH. */
  installHint: string;
}

export const AGENT_SPECS: Record<AgentId, AgentSpec> = {
  claude: {
    id: "claude",
    displayName: "Claude Code",
    command: "claude",
    args: [],
    installHint: "Install Claude Code CLI, then ensure `claude` is on your PATH.",
  },
  "cursor-agent": {
    id: "cursor-agent",
    displayName: "Cursor Agent",
    command: "cursor-agent",
    args: [],
    installHint: "Install the Cursor Agent CLI so `cursor-agent` is on your PATH.",
  },
  codex: {
    id: "codex",
    displayName: "Codex",
    command: "codex",
    args: [],
    installHint: "Install the OpenAI Codex CLI so `codex` is on your PATH.",
  },
  gemini: {
    id: "gemini",
    displayName: "Gemini CLI",
    command: "gemini",
    args: [],
    installHint: "Install Google Gemini CLI so `gemini` is on your PATH.",
  },
  shell: {
    id: "shell",
    displayName: "Shell",
    // Server may override on Windows; keep this browser-safe (no `process`).
    command: "/bin/zsh",
    args: ["-l"],
    installHint: "A login shell should already be available on your system.",
  },
};

export const AGENT_IDS = Object.keys(AGENT_SPECS) as AgentId[];

export function isAgentId(value: string): value is AgentId {
  return value in AGENT_SPECS;
}

/** Default ports — deliberately different from vibedeck (4317/5317). */
export const DEFAULT_SERVER_PORT = 4318;
export const DEFAULT_WEB_PORT = 5318;

export interface AgentAvailability {
  id: AgentId;
  displayName: string;
  available: boolean;
  command: string;
  installHint: string;
}

export interface SessionInfo {
  id: string;
  agentId: AgentId;
  cwd: string;
  cols: number;
  rows: number;
  createdAt: string;
  title: string;
}

export interface CreateSessionRequest {
  agentId: AgentId;
  cwd?: string;
  cols?: number;
  rows?: number;
  title?: string;
  initialInput?: string;
}

/** Client → server WebSocket messages */
export type ClientMessage =
  | { type: "input"; data: string }
  | { type: "resize"; cols: number; rows: number };

/** Server → client WebSocket messages */
export type ServerMessage =
  | { type: "ready"; session: SessionInfo }
  | { type: "output"; data: string }
  | { type: "exit"; code: number | null }
  | { type: "error"; message: string };


export type LayoutPreset = 1 | 2 | 4 | 6 | 8 | 12 | 16;

export interface WorkspacePaneSpec {
  agentId: AgentId;
  title?: string;
}

export interface WorkspaceTemplate {
  id: string;
  name: string;
  cwd?: string;
  layout: LayoutPreset;
  panes: WorkspacePaneSpec[];
  updatedAt: string;
}

export interface UpsertWorkspaceRequest {
  id?: string;
  name: string;
  cwd?: string;
  layout: LayoutPreset;
  panes: WorkspacePaneSpec[];
}

export interface LaunchWorkspaceResponse {
  workspace: WorkspaceTemplate;
  sessions: SessionInfo[];
}


export type KanbanColumn = "todo" | "in_progress" | "in_review" | "done";

export interface KanbanCard {
  id: string;
  title: string;
  body?: string;
  column: KanbanColumn;
  agentId: AgentId;
  sessionId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface UpsertKanbanCardRequest {
  id?: string;
  title: string;
  body?: string;
  column?: KanbanColumn;
  agentId?: AgentId;
}

export interface DispatchKanbanCardRequest {
  agentId?: AgentId;
  cwd?: string;
}


export interface FsEntry {
  name: string;
  path: string;
  type: "file" | "dir";
  size?: number;
}

export interface FsFileContent {
  path: string;
  content: string;
  truncated?: boolean;
}

export interface MemoryNote {
  id: string;
  title: string;
  content: string;
  updatedAt: string;
}


export type SwarmRole = "coordinator" | "builder" | "scout" | "reviewer";

export interface SwarmMember {
  role: SwarmRole;
  agentId: AgentId;
  sessionId?: string;
  title: string;
}

export interface FileOwnership {
  path: string;
  role: SwarmRole;
  sessionId: string;
  claimedAt: string;
}

export interface SwarmMailMessage {
  id: string;
  fromRole: SwarmRole | "human";
  body: string;
  createdAt: string;
}

export interface SwarmMission {
  id: string;
  name: string;
  mission: string;
  cwd?: string;
  status: "running" | "done" | "failed";
  members: SwarmMember[];
  ownership: FileOwnership[];
  mailbox: SwarmMailMessage[];
  plan: SwarmPlanNode[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateSwarmRequest {
  name: string;
  mission: string;
  cwd?: string;
  /** Override agent per role; defaults use claude for most, shell optional. */
  roles?: Partial<Record<SwarmRole, AgentId>>;
}

export interface ClaimFileRequest {
  path: string;
  role: SwarmRole;
  sessionId: string;
}

export interface PostSwarmMailRequest {
  fromRole: SwarmRole | "human";
  body: string;
}

export interface SkillSpec {
  id: string;
  name: string;
  description: string;
  prompt: string;
}

export interface ApplySkillRequest {
  sessionId: string;
}


export interface PromptSpec {
  id: string;
  name: string;
  body: string;
  updatedAt: string;
}

export interface UpsertPromptRequest {
  id?: string;
  name: string;
  body: string;
}

export interface ApplyPromptRequest {
  sessionId: string;
}

export type SwarmPlanStatus = "pending" | "doing" | "done";

export interface SwarmPlanNode {
  id: string;
  title: string;
  role?: SwarmRole;
  status: SwarmPlanStatus;
  children?: SwarmPlanNode[];
}
