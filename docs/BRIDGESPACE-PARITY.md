# BridgeSpace vs agentgrid — local ADE comparison

agentgrid is an **independent open-source sibling** inspired by BridgeSpace
(BridgeMind). It is **not** affiliated with BridgeMind and does not include
proprietary BridgeMind cloud products.

It is also **not** a clone of [Vibespace](https://github.com/hharsha98/Vibespace).
Vibespace is the related desktop ADE; Grid is the Cursor-lane checkout (ports
4318/5318, first-class `cursor-agent`). Do not merge the repos.

## Core ADE loop

| Capability | agentgrid | Honest note |
|---|---|---|
| Up to 16 terminal panes | Yes | Presets 1 / 2 / 4 / 6 / 8 / 12 / 16 |
| Freeform pane split / resize | Yes | Layout → Free: H/V split + drag handles |
| GPU-accelerated xterm | Yes | WebGL when the browser allows it; canvas fallback |
| Warp-style command blocks | Partial | OSC 133 for bundled zsh/bash integration only |
| Workspaces / templates | Yes | `~/.agentgrid/workspaces.json` |
| Kanban → dispatch agent | Yes | Shell payloads are shown via heredoc, not executed as the title |
| Agent ↔ kanban auto status | Yes | Session exit moves linked `in_progress` → `done` / `in_review` |
| File browser + code editor | Yes | Monaco; roots include cwd, not only `~/Projects` |
| File watch in editor | Yes | Polls mtime; stale banner + Reload (own saves refresh mtime) |
| Skills on panes | Yes | Apply button **or drag skill onto pane** (once, not twice) |
| Prompts library | Yes | Save / apply / delete under Prompts view |
| Swarm roles + file ownership | Partial | Four PTYs + JSON claims; not OS-enforced |
| Live mission plan tree | Partial | Flat per-role nodes; nested children API exists, UI is shallow |
| Shared swarm mailbox | Yes | Human + role notes on a mission (local JSON) |
| Shared memory / MCP | Yes | STDIO MCP (Content-Length + NDJSON) + local notes |
| Settings | Yes | Runtime, PATH agents, MCP snippet; studio Live = false |
| Native desktop (Tauri) | Partial | Dev shell auto-starts API on :4318; packaging not CI-verified |
| Themes | Yes | Phosphor / Amber / Contrast — not a 26-theme pack |
| Terminal search | Yes | ⌘/Ctrl+F + Search chip |
| Scroll-to-bottom | Yes | Floating control when scrolled up |
| Pane context menu | Yes | Copy / Paste / Clear |
| Multi-agent CLIs | Yes | Claude, Cursor Agent, Codex, Gemini, shell |
| Embedded localhost browser | No | Intentionally left to Vibespace |

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
| agentic-systems-studio.com Live URL | **No** — see [STUDIO.md](./STUDIO.md) |

## Remaining soft gaps

1. Windows/Linux desktop packaging polish (CI only checks Tauri config)
2. Deeper terminal image / graphics protocol support
3. Richer nested mission trees (multi-level planning UI)
4. agentskills.io disk discovery (Vibespace has this; Grid ships three bundled skills)

Updated after the Fleet-bar audit. If a row says Yes, there is a test or a
documented environment caveat in [STATUS.md](./STATUS.md).
