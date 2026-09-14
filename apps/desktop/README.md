# agentgrid desktop (Tauri)

Native window shell around the same React + xterm UI as the browser app.

**Status:** `pnpm desktop:dev` is the supported path. CI does **not** build a
signed DMG/NSIS/AppImage; `pnpm --filter @agentgrid/desktop test` only checks
`tauri.conf.json`. Treat packaging as unverified.

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

This is **not** the Vibespace release pipeline. Do not advertise Grid desktop
builds as Live on agentic-systems-studio.com.
