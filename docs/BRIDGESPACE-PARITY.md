# BridgeSpace vs agentgrid — feature parity

agentgrid is an **independent open-source sibling** inspired by BridgeSpace
(BridgeMind). It is **not** affiliated with BridgeMind and does not include
proprietary BridgeMind cloud products.

## Core ADE loop (shipped)

| BridgeSpace capability | agentgrid | Notes |
|---|---|---|
| Up to 16 terminal panes | Yes | Layouts 1 / 2 / 4 / 6 / 8 / 12 / 16 |
| GPU-accelerated xterm | Yes | WebGL when available |
| Warp-style command blocks | Yes | OSC 133 + shell integration |
| Workspaces / templates | Yes | `~/.agentgrid/workspaces.json` |
| Kanban → dispatch agent | Yes | Drag cards between columns + Dispatch |
| File browser + code editor | Yes | Monaco with language detection |
| Skills on panes | Yes | Apply button **or drag skill onto pane** |
| Swarm roles + file ownership | Yes | coordinator / builder / scout / reviewer |
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
| Arbitrary freeform pane splitters (infinite split) | Fixed presets only |
| Inline terminal image protocols | Not implemented |
| File watching auto-reload in editor | Manual reload / re-open |

## Remaining soft gaps (nice-to-have)

1. Freeform split/resize (vs fixed CSS grids)
2. Live mission tree visualization beyond members list
3. Automatic agent↔kanban status sync while agents run
4. Windows/Linux desktop packaging polish beyond macOS `.app`
5. Prompts library UI (beyond Skills markdown bundles)

Updated as of the BridgeSpace parity pass.
