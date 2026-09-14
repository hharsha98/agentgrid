# agentgrid

**agentgrid** is a local *agentic development environment* for the **Cursor lane**:
mission control for running Claude Code, **cursor-agent**, Codex, Gemini CLI, and
plain shells side by side in one browser window (or an optional Tauri shell).

It is **not** [Vibespace](https://github.com/hharsha98/Vibespace) (the related
desktop ADE) and **not** [Agent Fleet](https://github.com/hharsha98/agentfleet)
(the multi-agent ops platform). Do not merge those repos into this one. Ports
**4318 / 5318** are reserved so a Vibespace checkout can run at the same time.

**Studio:** this project is **not Live** on agentic-systems-studio.com. See
[docs/STUDIO.md](./docs/STUDIO.md).

Honest feature status (what works vs what is a stub): [docs/STATUS.md](./docs/STATUS.md).
BridgeSpace-inspired local ADE comparison: [docs/BRIDGESPACE-PARITY.md](./docs/BRIDGESPACE-PARITY.md).

## What is verified

CI (`pnpm typecheck && pnpm lint && pnpm test && pnpm build`) covers the
critical local paths: health, agent detection, PTY create/list/kill, session
exit, WebSocket I/O, workspace templates, kanban create/dispatch/exit-sync,
safe filesystem, memory notes, skills apply, prompts apply, swarm
mail/plan/launch, MCP JSON-RPC (Content-Length + NDJSON) including local
memory tools.

| Surface | Status | Notes |
|---|---|---|
| Terminals / PTY grid | **Works** | Real `node-pty` sessions; layout presets 1–16; free split |
| Agents | **Works** | PATH detection; missing CLIs return 409 with install hint |
| Kanban dispatch | **Works** | Dispatch opens a pane; shell tasks are *not* executed as commands |
| Files + Monaco | **Works** | Browse/edit under allowed roots (cwd + home + `~/Projects`) |
| Memory notes | **Works** | `~/.agentgrid/memory/*.md` |
| MCP | **Works** | STDIO; Content-Length (Cursor/Claude) and NDJSON; live tools need :4318 |
| Settings | **Works** | Runtime, PATH agents, MCP snippet, honest non-Live studio note |
| Swarm | **Partial** | Spawns 4 PTYs with role prompts; mailbox/plan/claims are local JSON — not OS-enforced |
| Skills / prompts | **Works** | Writes bundled/saved text into a live pane |
| Command blocks | **Partial** | OSC 133 for bundled zsh/bash integration; not `sh` / agent TUIs |
| Desktop (Tauri) | **Partial** | `pnpm desktop:dev` wraps the same UI; packaging is not CI-verified here |
| Public studio URL | **No** | Intentionally not claimed |

## Quickstart

Needs **Node 22** and **pnpm 11.15.1**.

```bash
git clone https://github.com/hharsha98/agentgrid.git
cd agentgrid
pnpm install
pnpm dev
```

Open **http://localhost:5318**

- Server listens on **http://127.0.0.1:4318**
- Web proxies `/api` (including WebSockets) to the server

Optional desktop shell (needs Rust via `rustup`; auto-starts the API on :4318):

```bash
pnpm desktop:dev
```

### What CI actually runs

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm build
```

PTY tests spawn a real shell. They do **not** require Claude/Cursor/Codex to be
installed. A cloud VM without a working `node-pty` build will fail those tests —
that is a missing native dependency, not a product regression.

## Shared memory MCP

```bash
pnpm --filter @agentgrid/mcp start
```

Point Cursor / Claude MCP config at that command (`cwd` = this repo). The server
speaks JSON-RPC 2.0 over stdio with **Content-Length** framing (and also
newline-delimited JSON).

**Local memory tools** (no API required): `memory_list`, `memory_read`,
`memory_write`, `memory_delete` — notes in `~/.agentgrid/memory/`.

**Live API tools** (need server on :4318): `health`, `agents_list`,
`sessions_list`, `fs_*`, `kanban_*`, `swarm_*`, `skills_*`, `workspaces_list`.

## Project layout

```
agentgrid/
├── apps/
│   ├── server/    # Fastify + node-pty (port 4318)
│   ├── web/       # React + Vite + xterm (port 5318)
│   └── desktop/   # Tauri native shell around the web UI
└── packages/
    ├── shared/    # Types + agent specs shared by both sides
    └── mcp/       # STDIO MCP for shared memory + live API
```

## License

MIT — see [LICENSE](./LICENSE).
