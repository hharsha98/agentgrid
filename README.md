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
- Keyboard shortcuts (⌘/Ctrl+1/2/4, Enter, S, [ ])
- Warp-style command blocks for shell panes (OSC 133)
- Kanban board with Dispatch → agent session
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

## Roadmap

- [x] **Phase 0 — Foundation**: pnpm workspace, CI, shared protocol, Fastify + React
- [x] **Phase 1 — Terminal core**: PTY sessions, WebSocket I/O, scrollback, agent PATH detection
- [x] **Phase 2 — Grid (MVP)**: 1 / 2 / 4 pane layouts
- [x] **Phase 3 — Workspaces**: named workspace + browser prefs
- [x] **Phase 3b — Workspace templates**: saved under `~/.agentgrid/workspaces.json`, open/launch from sidebar
- [x] **Phase 4 — Keyboard shortcuts**: layout, launch, save, focus (themes still TODO)
- [x] **Phase 5 — Command blocks** (OSC 133 markers + collapsible command list for shell panes)
- [ ] **Phase 6 — File tree + light editor**
- [x] **Phase 7 — Kanban board** that dispatches agents into panes
- [ ] **Phase 8 — Shared memory / MCP**
- [ ] **Phase 9 — Swarm roles + file ownership**
- [ ] **Phase 10 — Skills**
- [ ] **Phase 11 — Desktop app (Tauri)**

## Project layout

```
agentgrid/
├── apps/
│   ├── server/    # Fastify + node-pty (port 4318)
│   └── web/       # React + Vite + xterm (port 5318)
└── packages/
    └── shared/    # Types + agent specs shared by both sides
```

## License

MIT — see [LICENSE](./LICENSE).
