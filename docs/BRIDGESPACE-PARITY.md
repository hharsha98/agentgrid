# BridgeSpace vs agentgrid — feature parity

agentgrid is an **independent open-source sibling** inspired by BridgeSpace
(BridgeMind). It is **not** affiliated with BridgeMind and does not include
proprietary BridgeMind cloud products.

## Core ADE loop (shipped)

| BridgeSpace capability | agentgrid | Notes |
|---|---|---|
| Up to 16 terminal panes | Yes | Layouts 1 / 2 / 4 / 6 / 8 / 12 / 16 |
| Freeform pane split / resize | Yes | Layout → Free: H/V split + drag handles |
| GPU-accelerated xterm | Yes | WebGL when available |
| Warp-style command blocks | Yes | OSC 133 + shell integration |
| Workspaces / templates | Yes | `~/.agentgrid/workspaces.json` |
| Kanban → dispatch agent | Yes | Drag cards between columns + Dispatch |
| Agent ↔ kanban auto status | Yes | Session exit moves linked `in_progress` → `done` / `in_review` |
| File browser + code editor | Yes | Monaco with language detection |
| File watch in editor | Yes | Polls mtime; stale banner + Reload |
| Skills on panes | Yes | Apply button **or drag skill onto pane** |
| Prompts library | Yes | Save / apply / delete under Prompts view |
| Swarm roles + file ownership | Yes | coordinator / builder / scout / reviewer |
| Live mission plan tree | Yes | Per-role nodes with pending / doing / done |
| Shared swarm mailbox | Yes | Human + role notes on a mission |
| Shared memory / MCP | Yes | STDIO MCP + local notes |
| Native desktop (Tauri) | Yes | Auto-starts API on :4318 |
| Themes | Yes | Phosphor / Amber / Contrast |
| Terminal search | Yes | ⌘/Ctrl+F + Search chip |
| Scroll-to-bottom | Yes | Floating control when scrolled up |
| Pane context menu | Yes | Copy / Paste / Clear |
| Multi-agent CLIs | Yes | Claude, Cursor Agent, Codex, Gemini, shell |

## Intentionally out of scope (proprietary / cloud)

| BridgeSpace / BridgeMind | agentgrid |
|---|---|
| BridgeMind account sign-in | No |
| BridgeBoard sync to BridgeMind API | Local JSON only |
| BridgeVoice | No |
| BridgeAgent autonomous loop product | No |
| BridgeShot | No |
| Paid / freemium cloud billing | No |
| Inline terminal image protocols | Not implemented |

## Remaining soft gaps (nice-to-have)

1. Windows/Linux desktop packaging polish beyond macOS `.app`
2. Deeper terminal image / graphics protocol support
3. Richer nested mission trees (multi-level planning UI)

Updated as of the full local parity pass.
