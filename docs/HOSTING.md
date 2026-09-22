# Hosting — local first

Agent Grid spawns real shells. The API listens on **127.0.0.1:4318** only.
There is no login. Do not put port 4318 or 5318 on the public internet.

`studio.live` is always `false`. `publicUrl` is always `null`.
`DEMO_PUBLIC` does not change that. It only fills in missing vendor CLIs with
local simulators on the same machine.

This repo is **not** deployed on agentic-systems-studio.com.

## Supported path

On your laptop:

```bash
pnpm install
pnpm demo
```

Open http://127.0.0.1:5318. Docker is not required.

`pnpm dev` is the same stack with simulators off. Missing CLIs then return HTTP 409.

## Contabo (single operator)

A Contabo VPS can run the same Node process for one person, reached through an
SSH tunnel. That is a private remote desktop for the grid, not a public studio.

1. Install Node 22 and pnpm 11.15.1. Clone the repo. `pnpm install`.
2. Run `pnpm demo` under tmux or systemd **as a normal user**, still bound to
   127.0.0.1. No API keys are required for the simulator demo.
3. From your laptop:

```bash
ssh -L 5318:127.0.0.1:5318 user@your-contabo-host
```

4. Open http://127.0.0.1:5318. Vite on the VPS proxies `/api` to 127.0.0.1:4318,
   so you do not tunnel 4318.

Example systemd unit (adjust paths and the user). Do not add a public
`Listen` or a reverse proxy without authentication you operate yourself:

```ini
[Service]
Type=simple
User=agentgrid
WorkingDirectory=/opt/agentgrid
Environment=DEMO_PUBLIC=1
ExecStart=/usr/bin/pnpm demo
Restart=on-failure
```

If `claude`, `cursor-agent`, `codex`, or `gemini` is installed for that user,
demo mode uses the real binary for that agent. The simulators are the fallback.

There is no Docker image in this repo. Do not treat a container publish of the
PTY API as the demo.
