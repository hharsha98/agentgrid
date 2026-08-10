/** Shared protocol between the Fastify server and the React web app. */

export type AgentId = "claude" | "cursor-agent" | "codex" | "shell";

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


export type LayoutPreset = 1 | 2 | 4;

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
