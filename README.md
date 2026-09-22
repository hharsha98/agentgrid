# agentgrid

**agentgrid** is a local multi-agent terminal grid for the **Cursor lane**:
panes, shells, and coding CLIs (Claude Code, cursor-agent, Codex, Gemini) in
one browser window, plus kanban dispatch.

It is **not** [Vibespace](https://github.com/hharsha98/Vibespace) and **not**
[Agent Fleet](https://github.com/hharsha98/agentfleet). Do not merge those
repos into this one. Ports **4318 / 5318** stay free of Vibespace’s 4317 / 5317.

It is **not Live** on agentic-systems-studio.com. The API binds `127.0.0.1`.
See [docs/HOSTING.md](./docs/HOSTING.md) and [docs/STUDIO.md](./docs/STUDIO.md).

## 10-minute demo

No Claude, Cursor, Codex, or Gemini install is required. Docker is not required.
Needs **Node 22** and **pnpm 11.15.1**.

```bash
git clone https://github.com/hharsha98/agentgrid.git
cd agentgrid
pnpm install
pnpm demo
```

Open **http://127.0.0.1:5318**. `pnpm demo` sets `DEMO_PUBLIC=1`.

| Minute | Do this | You should see |
|---|---|---|
| 0–2 | Install and `pnpm demo` | Banner: DEMO_PUBLIC. Server online. Studio Live is off. |
| 2–4 | **Demo grid (4)** | Four panes. Missing CLIs say `sim` and answer in the terminal. Type a sentence; the reply quotes it. |
| 4–6 | **Board** → Dispatch “Explain the terminal grid” | A pane opens with the card text. Type `exit` (code 0) and the card moves to Done. |
| 6–8 | Layout **4**, then **Free**, split with H/V | Presets and a draggable split. **Two shells** is a real shell, not a simulator. |
| 8–10 | **Files**, **Swarm** (name + mission), **Settings** | Monaco under the repo root. Four swarm panes. Settings lists native vs simulated. |

`pnpm dev` is the same UI with simulators **off**. A missing CLI then returns
HTTP 409 and the picker shows `(missing)`.

If a vendor binary is already on `PATH`, demo mode uses that real program for
that agent. The simulator never replaces an installed CLI.

An empty kanban file gets three starter cards on demo startup. An existing
`~/.agentgrid/kanban.json` is left alone.

## What is verified

CI runs `pnpm typecheck && pnpm lint && pnpm test && pnpm smoke && pnpm build`.
`pnpm smoke` boots the real server (no Docker): health, a shell PTY over
WebSocket, a simulated agent reply when that CLI is missing, and kanban dispatch.

| Surface | Status | Notes |
|---|---|---|
| Terminals / PTY grid | **Works** | Real `node-pty`; presets 1–16; free split |
| Agents | **Works** | PATH detection. `DEMO_PUBLIC` simulates missing CLIs. Otherwise 409 |
| Kanban dispatch | **Works** | Opens a pane. Shell tasks are shown with a heredoc, not executed |
| Files + Monaco | **Works** | Allowed roots: cwd, home, `~/Projects`, `AGENTGRID_FS_ROOTS` |
| Memory notes | **Works** | `~/.agentgrid/memory/*.md` |
| MCP | **Works** | STDIO; Content-Length and NDJSON. Live tools need :4318 |
| Settings | **Works** | Runtime, native vs simulated, studio Live = false |
| Swarm | **Partial** | Four PTYs plus local JSON mail/plan/claims. Not OS-enforced |
| Skills / prompts | **Works** | Writes text into a live pane |
| Command blocks | **Partial** | OSC 133 for bundled zsh/bash only |
| Desktop (Tauri) | **Partial** | `pnpm desktop:dev`. Packaging is not CI-verified |
| Public studio URL | **No** | Intentionally not claimed |

Honest detail: [docs/STATUS.md](./docs/STATUS.md). Comparison notes:
[docs/BRIDGESPACE-PARITY.md](./docs/BRIDGESPACE-PARITY.md).

## Other commands

```bash
pnpm dev          # no simulators
pnpm smoke        # native API smoke
pnpm typecheck && pnpm lint && pnpm test && pnpm build
pnpm desktop:dev  # optional Tauri shell; needs Rust
```

PTY tests spawn a real shell. They do not need vendor CLIs. A machine without
a working `node-pty` build will fail those tests.

## Shared memory MCP

```bash
pnpm --filter @agentgrid/mcp start
```

Point Cursor / Claude MCP config at that command (`cwd` = this repo).

**Local memory tools** (no API): `memory_list`, `memory_read`, `memory_write`,
`memory_delete`.

**Live API tools** (server on :4318): `health`, `agents_list`, `sessions_list`,
`fs_*`, `kanban_*`, `swarm_*`, `skills_*`, `workspaces_list`.

## Layout

```
agentgrid/
├── apps/
│   ├── server/    # Fastify + node-pty (127.0.0.1:4318)
│   ├── web/       # React + Vite + xterm (127.0.0.1:5318)
│   └── desktop/   # optional Tauri shell
└── packages/
    ├── shared/    # types + agent specs
    └── mcp/       # STDIO MCP
```

## License

MIT — see [LICENSE](./LICENSE).
