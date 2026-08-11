# BridgeSpace vs agentgrid — feature + visual parity

agentgrid is an **independent open-source sibling** inspired by BridgeSpace
(BridgeMind). It is **not** affiliated with BridgeMind and does not include
proprietary BridgeMind cloud products or logos.

## Visual / chrome (shipped)

| BridgeSpace structure | agentgrid | Notes |
|---|---|---|
| Top workspace chrome | Yes | Top bar: AG brand, workspace, health, theme, Dock/Inspect |
| Activity rail | Yes | Grid / Board / Swarm / Files / Memory / Skills / Prompts / Browser |
| Collapsible inspector | Yes | Launch, layouts, templates, sessions (`⌘,`) |
| Terminal-first main stage | Yes | Preset grids + free H/V splits |
| Docked files/editor | Yes | Dock toggle or Files rail |
| Bottom command bar | Yes | Focused / All / `@role` targets |
| Dark CRT themes | Yes | Phosphor / Amber / Contrast |

## Core ADE loop (shipped)

| BridgeSpace capability | agentgrid | Notes |
|---|---|---|
| Up to 16 terminal panes | Yes | Layouts 1 / 2 / 4 / 6 / 8 / 10 / 12 / 14 / 16 |
| Freeform pane split / resize | Yes | Free mode + `⌘D` |
| GPU-accelerated xterm | Yes | WebGL when available |
| Warp-style command blocks | Yes | OSC 133; collapse when done; click to expand |
| Workspaces / templates | Yes | `~/.agentgrid/workspaces.json` |
| Kanban → dispatch agent | Yes | Drag + Dispatch; session title on card |
| Agent ↔ kanban auto status | Yes | Exit → `done` / `in_review` |
| File browser + code editor | Yes | Monaco + dock |
| File watch in editor | Yes | mtime poll + Reload |
| Drag path onto terminal | Yes | From files tree |
| Skills on panes | Yes | Apply or drag |
| Prompts library | Yes | Save / apply / delete |
| Swarm roles + ownership | Yes | coordinator / builder / scout / reviewer |
| Live mission plan tree | Yes | Status chips + one-level children |
| Shared swarm mailbox | Yes | Human + role notes |
| Command bar steer | Yes | `POST /api/sessions/broadcast` |
| Shared memory / MCP | Yes | `~/.agentgrid/memory` or `{cwd}/.agentgrid-memory` + `[[links]]` |
| Embedded localhost browser | Yes | Sandboxed iframe review pane |
| Native desktop (Tauri) | Yes | Auto-starts API on :4318 |
| Keyboard-first | Yes | `⌘N` new, `⌘D` split, `⌘B` board, `⌘⇧S` swarm, `⌘F` search |

## Intentionally out of scope (proprietary / cloud)

| BridgeSpace / BridgeMind | agentgrid |
|---|---|
| BridgeMind logos / wordmarks | No (agentgrid AG branding only) |
| BridgeMind account sign-in | No |
| BridgeBoard sync to BridgeMind API | Local JSON only |
| BridgeVoice | No |
| BridgeAgent autonomous loop product | No |
| BridgeShot | No |
| Paid / freemium cloud billing | No |
| Inline terminal image protocols | Not implemented |

## Soft gaps

1. Windows/Linux desktop packaging polish beyond macOS `.app`
2. Deeper terminal image / graphics protocol support
3. Multi-level mission trees beyond one child level

Updated as of the ADE visual/structural clone pass.
