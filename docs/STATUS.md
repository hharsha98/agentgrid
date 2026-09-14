# agentgrid — honest status

Last updated: 2026-09-14. This is the audit used to stop claiming features that
do not work. “Works” means a critical path is implemented **and** covered by
automated tests, or exercised by a real PTY in CI. “Partial” means the UI/API
exists but is cooperative, environment-dependent, or not CI-packaged.
“Stub” means advertised without a working path.

## Surfaces

| Surface | Status | Evidence | Remaining gaps |
|---|---|---|---|
| Health + settings | Works | `GET /api/health`, `GET /api/settings` | Settings is local-only; no remote config |
| Agent PATH detection | Works | `GET /api/agents`; shell is always expected | Windows `.exe` lookup is best-effort |
| PTY sessions | Works | create/list/delete + exit status + WS I/O tests | Scrollback kept until kill; no remote attach |
| Grid layouts | Works | presets 1/2/4/6/8/12/16; free split unit tests | No 10/14 presets (Vibespace/BridgeSpace extras) |
| Workspace templates | Works | save/list/launch/delete HTTP tests | Launch fails closed if a pane’s CLI is missing |
| Kanban | Works | create, dispatch, drag columns, exit → done/in_review | Default agent is **shell** if unspecified |
| Files / Monaco | Works | safe-fs tests; mtime poll; create+save in UI | Roots = cwd + `AGENTGRID_FS_ROOTS` + `~/Projects` + home |
| Memory | Works | store tests + MCP local tools | Markdown files only; no graph/wiki |
| MCP | Works | Content-Length + NDJSON framing tests; memory round-trip | Live tools error (`isError`) when API is down |
| Skills | Works | bundled markdown; apply to live session (409 if exited) | Not the agentskills.io disk discovery Vibespace has |
| Prompts | Works | save/apply/delete HTTP tests | Library is local JSON, not shared across machines |
| Swarm | Partial | 4 PTYs + mailbox/plan/claim API tests | Prompt-into-pane, not a DAG orchestrator; claims are JSON |
| Command blocks | Partial | OSC 133 parser unit tests | Need bundled zsh `ZDOTDIR` or bash `--rcfile` |
| Keyboard shortcuts | Works | skipped while typing / in Monaco | Cmd+S in Files saves the file, not a workspace |
| Themes | Works | Phosphor / Amber / Contrast unit tests | Not Vibespace’s 26-theme set |
| Desktop (Tauri) | Partial | config check in CI (`check-config.mjs`) | No packaged DMG/NSIS verification in this repo |
| Embedded browser pane | No | Out of scope for Cursor-lane Grid | Lives in Vibespace; do not half-port it |
| Studio Live URL | No | `studio.live` is always `false` | See [STUDIO.md](./STUDIO.md) |

## Failures that were real (and the fix)

1. **Kanban → shell executed the card title as a command.** Dispatch now wraps
   shell payloads in a heredoc (`formatInitialInput`).
2. **Dead PTYs still accepted writes / skill apply.** Sessions now have
   `status: running | exited`; apply returns 409 after exit.
3. **Reconnect after exit never sent `exit`.** WebSocket subscribe replays
   scrollback and then the exit event.
4. **Zsh command-block integration never loaded.** `ZDOTDIR` pointed at a folder
   whose rc file was named `zshrc`; zsh only reads `$ZDOTDIR/.zshrc`. Renamed.
4. **Files view could not see the repo** when cwd was outside `~/Projects`.
   `defaultRoots()` now includes `process.cwd()` and `AGENTGRID_FS_ROOTS`.
5. **Saving a file in Monaco flagged it stale.** Save now refreshes `mtimeMs`.
6. **Cmd+S in the editor saved a workspace template.** Shortcuts ignore
   editable targets; Files handles Cmd+S itself.
7. **MCP only spoke newline JSON.** Framing accepts Content-Length (Cursor /
   Claude Desktop) and NDJSON.
8. **Kanban defaulted to `claude`**, so “Add card” dispatched a missing CLI.
   Default is `shell`.
9. **Skill drop could fire twice** (terminal host + pane). Terminal no longer
   applies skills; the pane does it once.
10. **5s session poll refilled empty free-layout panes.** Poll now keeps the
    previous snapshot when IDs/status match.

## Differentiation

| | Agent Grid | Vibespace | Agent Fleet |
|---|---|---|---|
| Job | Cursor-lane ADE (terminals + dispatch) | Desktop ADE product | Multi-agent ops platform |
| Ports | 4318 / 5318 | its own | 3002 / 8000 typical |
| Persistence | `~/.agentgrid` JSON + markdown | richer local store | Postgres + pgvector |
| “Live” studio | **No** | n/a | n/a here |

Do not duplicate Vibespace’s browser pane, 26 themes, or release signing story
as half-features in Grid. Keep Grid’s unique lane: **first-class `cursor-agent`**,
isolated ports, honest local MCP.
