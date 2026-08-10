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
The packaged UI talks to `http://127.0.0.1:4318`, so start the server
(`pnpm --filter @agentgrid/server start`) alongside the app for now.
