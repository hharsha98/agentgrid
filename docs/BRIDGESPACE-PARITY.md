# BridgeSpace vs agentgrid — feature + visual parity

agentgrid is an **independent open-source sibling** inspired by BridgeSpace
(BridgeMind). It is **not** affiliated with BridgeMind and does not include
proprietary BridgeMind cloud products or logos.

Checked against public docs: https://docs.bridgemind.ai/docs/bridgespace
and https://www.bridgemind.ai/products/bridgespace

## Visual / chrome (shipped)

| BridgeSpace structure | agentgrid | Notes |
|---|---|---|
| Top workspace chrome | Yes | AG brand + color-coded workspace tabs + theme + Dock/Inspect/Settings |
| Activity rail | Yes | Grid / Board / Swarm / Files / Memory / Skills / Prompts / Browser |
| Collapsible inspector | Yes | Launch, layouts, templates, sessions (`⌘,`) |
| Settings | Yes | Appearance / Terminal / Shortcuts / About (local only) |
| Terminal-first main stage | Yes | Preset grids + free H/V splits |
| Docked files/editor | Yes | Dock toggle or Files rail |
| Bottom command bar | Yes | Follows focused pane; All / `@role` targets |
| 25+ themes | Yes | 27 independent palettes (dark + light). No BridgeMind-named theme. |

## Core ADE loop (shipped)

| BridgeSpace capability | agentgrid | Notes |
|---|---|---|
| Up to 16 terminal panes | Yes | Layouts 1 / 2 / 4 / 6 / 8 / 10 / 12 / 14 / 16 |
| Freeform pane split / resize | Yes | Free mode + `⌘D`; H/V on preset panes |
| GPU-accelerated xterm | Yes | WebGL when available |
| Warp-style command blocks | Yes | OSC 133; command, output, exit, timestamp; collapse |
| Terminal search | Yes | `⌘F` |
| Context menu | Yes | Copy / paste / clear / split |
| Drag path onto terminal | Yes | Files tree + OS file drop |
| Scroll to bottom | Yes | Floating jump control |
| Quick Open | Yes | `⌘P` |
| Session tab strip | Yes | Agent label + focus/close |
| Multi-workspace tabs | Yes | `⌘T` new, `⌘W` close, `⌘1–9` switch; color via right-click |
| Workspaces / templates | Yes | Saved templates open into a new workspace tab |
| Kanban → dispatch agent | Yes | Todo / In Progress / In Review / Done; drag + Dispatch |
| Agent ↔ kanban auto status | Yes | Exit → `done` / `in_review` |
| File browser + code editor | Yes | Nested tree, tabs, Monaco, file watch |
| Skills on panes | Yes | Apply or drag |
| Prompts library | Yes | Save / apply / delete |
| Swarm roles + ownership | Yes | coordinator / builder / scout / reviewer |
| Live mission plan tree | Yes | Multi-level, collapse, + root / + child |
| Shared swarm mailbox | Yes | Human + role notes |
| Command bar steer | Yes | Broadcast / `@role` |
| Shared memory / MCP | Yes | Local markdown + MCP |
| Embedded localhost browser | Yes | Sandboxed iframe |
| Native desktop (Tauri) | Yes | Auto-starts API on :4318 |
| Keyboard-first | Yes | Matches docs: T/W/P/F/D/1–9 plus ADE extras |

## Intentionally out of scope (proprietary / cloud)

| BridgeSpace / BridgeMind | agentgrid |
|---|---|
| BridgeMind logos / wordmarks | No (agentgrid AG branding only) |
| BridgeMind account sign-in | No |
| BridgeBoard two-way cloud sync | Local JSON only |
| BridgeVoice / voice orb | No |
| BridgeAgent autonomous loop product | No |
| BridgeShot | No |
| Paid / freemium billing / accounts | No |
| Inline terminal image protocols | Not implemented |
| Theme named "BridgeMind" | Replaced by independent palettes |

## Soft gaps

1. Windows/Linux desktop packaging polish beyond macOS `.app`
2. Deeper terminal image / graphics protocol support
3. SSH profiles (BridgeSpace Settings extra; not in the public ADE core loop)

Updated after a full docs-vs-app re-audit of local ADE features and chrome.
