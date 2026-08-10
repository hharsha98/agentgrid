# agentgrid desktop (Tauri)

Native window shell around the same React + xterm UI as the browser app.

## Dev

Needs **Rust** (`rustup`) and the monorepo deps.

```bash
# from repo root
pnpm install
pnpm desktop:dev
```

This starts the Fastify server (:4318), Vite web (:5318), and a Tauri window
pointed at the web UI.

You can also keep using the browser at http://127.0.0.1:5318 — same backend.

## Production build

```bash
pnpm desktop:build
```

Builds `apps/web` into static assets and packages a native app via Tauri.
On launch, the app runs `scripts/ensure-server.mjs`, which starts
`@agentgrid/server` on :4318 if it is not already healthy. Set
`AGENTGRID_ROOT` if the monorepo is not discoverable from the app bundle.
