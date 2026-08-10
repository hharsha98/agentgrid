# agentgrid

**agentgrid** is a BridgeSpace-inspired *agentic development environment* —
mission control for running multiple AI coding agents side by side in one
browser window.

This is the **Cursor lane**. It is intentionally separate from
[`vibedeck`](https://github.com/hharsha98/vibedeck) (Claude Code’s project).
Do not merge the two repos.

| | vibedeck (Claude Code) | agentgrid (Cursor) |
|---|---|---|
| Folder | `Projects/vibedeck` | `Projects/agentgrid` |
| Ports | 4317 / 5317 | **4318 / 5318** |
| GitHub | `hharsha98/vibedeck` | `hharsha98/agentgrid` |

## What it does today

- Local Fastify server that spawns real PTY sessions (`node-pty`)
- React + xterm.js UI with GPU rendering when available
- Launch **Claude Code**, **cursor-agent**, **Codex**, or a plain **shell**
- Layout presets: 1 / 2 / 4 panes visible at once
- Named workspace label; layout / cwd / agent preference saved in the browser
- Saved workspace templates on disk (`~/.agentgrid/workspaces.json`) with one-click relaunch
- Keyboard shortcuts (⌘/Ctrl+1/2/4, Enter, S, [ ], Shift+T cycles theme)
- Themes: Phosphor (green), Amber (warm CRT), Contrast (high-contrast)
- Warp-style command blocks for shell panes (OSC 133)
- Kanban board with Dispatch → agent session
- Files view (safe browse/edit under Projects/home) + shared Memory notes + MCP
- Swarm missions (coordinator / builder / scout / reviewer) with file ownership claims
- Skills library — apply bundled prompts (security-review, commit-and-push, seo-audit) into a pane
- Optional **Tauri desktop** shell (`pnpm desktop:dev`) wrapping the same UI
- Session list survives browser refresh (server keeps PTYs alive until you kill them)

## Quickstart

Needs **Node 22** and **pnpm 11.15.1**.

```bash
cd ~/Projects/agentgrid
pnpm install
pnpm dev
```

Open **http://localhost:5318**

- Server listens on **http://127.0.0.1:4318**
- Web proxies `/api` (including WebSockets) to the server

Desktop shell (needs Rust via `rustup`):

```bash
pnpm desktop:dev
```

## Roadmap

- [x] **Phase 0 — Foundation**: pnpm workspace, CI, shared protocol, Fastify + React
- [x] **Phase 1 — Terminal core**: PTY sessions, WebSocket I/O, scrollback, agent PATH detection
- [x] **Phase 2 — Grid (MVP)**: 1 / 2 / 4 pane layouts
- [x] **Phase 3 — Workspaces**: named workspace + browser prefs
- [x] **Phase 3b — Workspace templates**: saved under `~/.agentgrid/workspaces.json`, open/launch from sidebar
- [x] **Phase 4 — Keyboard shortcuts + themes**: layout, launch, save, focus; Phosphor / Amber / Contrast
- [x] **Phase 5 — Command blocks** (OSC 133 markers + collapsible command list for shell panes)
- [x] **Phase 6 — File tree + light editor** (Files view; text files under allowed roots)
- [x] **Phase 7 — Kanban board** that dispatches agents into panes
- [x] **Phase 8 — Shared memory / MCP** (`~/.agentgrid/memory` + `@agentgrid/mcp` STDIO server)
- [x] **Phase 9 — Swarm roles + file ownership** (coordinator/builder/scout/reviewer)
- [x] **Phase 10 — Skills** (security-review, commit-and-push, seo-audit)
- [x] **Phase 11 — Desktop app (Tauri)** (`pnpm desktop:dev`)

## Project layout

```
agentgrid/
├── apps/
│   ├── server/    # Fastify + node-pty (port 4318)
│   ├── web/       # React + Vite + xterm (port 5318)
│   └── desktop/   # Tauri native shell around the web UI
└── packages/
    ├── shared/    # Types + agent specs shared by both sides
    └── mcp/       # STDIO MCP for shared memory
```

## License

MIT — see [LICENSE](./LICENSE).


## Shared memory MCP

Agents can read/write the same notes via a small STDIO MCP server:

```bash
pnpm --filter @agentgrid/mcp start
```

Point Claude Code / Cursor MCP config at that command (cwd = this repo). Tools:
`memory_list`, `memory_read`, `memory_write`. Notes live in `~/.agentgrid/memory/`.
