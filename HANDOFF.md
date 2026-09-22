# HANDOFF

Agent Grid is a local multi-agent terminal grid (panes, real shells, kanban
dispatch, files, swarm). This pass makes that grid demoable when Claude,
Cursor Agent, Codex, and Gemini are not installed.

It is not Vibespace and not Agent Fleet. It is not Live on
agentic-systems-studio.com.

## Run the demo (under 10 minutes)

```bash
pnpm install
pnpm demo
```

Open **http://127.0.0.1:5318**.

1. **Demo grid (4)** — four panes. Missing CLIs are labeled `sim` and answer in the terminal.
2. **Board** — an empty kanban file is seeded with three cards. Dispatch one. Type `exit` in that pane (code 0) and the card moves to Done.
3. Layout presets and **Free** split. **Two shells** is a real shell.
4. **Files** opens Monaco. **Swarm** opens four role panes. **Settings** lists native vs simulated and keeps Studio Live off.

`pnpm dev` is the same UI with simulators off (missing CLIs return HTTP 409).

## What DEMO_PUBLIC is

`DEMO_PUBLIC=1` (set by `pnpm demo`) spawns `apps/server/src/pty/sim-agent.mjs`
under a real PTY when a vendor binary is missing. The simulator quotes the
prompt and does not call a model or the network. If the real binary is on
`PATH`, that pane is the real program.

Shell is always the real login shell. Shell kanban cards are still shown with
a heredoc so the title is not executed.

## Hosting

Local is the supported path. The API listens on `127.0.0.1:4318` only.
`studio.live` is false and `publicUrl` is null.

A Contabo VPS can run `pnpm demo` for one operator behind an SSH tunnel.
Do not publish the ports. Details: [docs/HOSTING.md](./docs/HOSTING.md).
Docker is not required and there is no image in this repo.

## Verified here

- `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm smoke`, `pnpm build`
- `pnpm smoke` boots the real server: health, shell PTY over WebSocket, simulated Claude reply, kanban dispatch. On this machine Claude was simulated.
- Browser at http://127.0.0.1:5318: demo banner, four simulated panes, typed `hi` and got a local reply, seeded board, dispatch opened a visible pane with the card text, Files opened `package.json` in Monaco, swarm launched four roles, Settings showed Live no and the simulated agent list.

## Still partial (do not claim these as done)

- Swarm file claims are local JSON, not OS locks.
- Command blocks need the bundled zsh/bash integration.
- Tauri `pnpm desktop:dev` is a shell around the same UI. Packaged installers are not verified in CI.
- No public studio hostname.
