# BridgeSpace vs agentgrid — feature + visual parity

agentgrid is an **independent open-source sibling** inspired by BridgeSpace
(BridgeMind). It is **not** affiliated with BridgeMind and does not include
proprietary BridgeMind cloud products or logos.

## Visual / chrome (shipped)

| BridgeSpace structure | agentgrid | Notes |
|---|---|---|
| Top workspace chrome | Yes | AG brand + **workspace tabs** + rename + theme select + Dock/Inspect |
| Activity rail | Yes | Icon-mark rail (Grid / Board / Swarm / Files / Memory / Skills / Prompts / Browser) |
| Collapsible inspector | Yes | Launch, layouts, templates, sessions (`⌘,`) |
| Terminal-first main stage | Yes | Preset grids + free H/V splits |
| Docked files/editor | Yes | Dock toggle or Files rail |
| Bottom command bar | Yes | Follows focused pane; All / `@role` targets |
| Dark CRT themes | Yes | 10 themes via dropdown (not a chip strip) |

## Core ADE loop (shipped)

| BridgeSpace capability | agentgrid | Notes |
|---|---|---|
| Up to 16 terminal panes | Yes | Layouts 1 / 2 / 4 / 6 / 8 / 10 / 12 / 14 / 16 |
| Freeform pane split / resize | Yes | Free mode + `⌘D`; H/V on preset panes switches to free |
| GPU-accelerated xterm | Yes | WebGL when available |
| Warp-style command blocks | Yes | OSC 133 via `shell-integration/.zshrc` + ZDOTDIR |
| Quick Open | Yes | `⌘P` + `GET /api/fs/search` |
| Session tab strip | Yes | Agent label + focus/close |
| Multi-workspace tabs | Yes | Local open tabs (switch isolates sessions/layout); not cloud sync |
| Workspaces / templates | Yes | Saved templates open into a **new** workspace tab |
| Kanban → dispatch agent | Yes | Drag + Dispatch; session title on card |
| Agent ↔ kanban auto status | Yes | Exit → `done` / `in_review` |
| File browser + code editor | Yes | Monaco + dock; nested expand; editor tabs |
| File watch in editor | Yes | mtime poll; auto-reload when clean |
| Drag path onto terminal | Yes | From files tree |
| Skills on panes | Yes | Apply or drag |
| Prompts library | Yes | Save / apply / delete |
| Swarm roles + ownership | Yes | coordinator / builder / scout / reviewer |
| Live mission plan tree | Yes | Multi-level children, collapse, + root / + child, optional role |
| Shared swarm mailbox | Yes | Human + role notes |
| Command bar steer | Yes | `POST /api/sessions/broadcast` |
| Shared memory / MCP | Yes | `~/.agentgrid/memory` or `{cwd}/.agentgrid-memory` |
| Embedded localhost browser | Yes | Sandboxed iframe review pane |
| Native desktop (Tauri) | Yes | Auto-starts API on :4318 |
| Keyboard-first | Yes | See inspector shortcut sheet |

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
| Exact BridgeSpace theme name catalog (25+) | Closest local set of 10 |

## Soft gaps

1. Windows/Linux desktop packaging polish beyond macOS `.app`
2. Deeper terminal image / graphics protocol support

Updated after workspace-tab + mission-tree + chrome polish pass.
