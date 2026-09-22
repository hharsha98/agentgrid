# Studio deploy — not Live

**Do not claim Live on agentic-systems-studio.com for Agent Grid.**

This file exists so a later session does not “helpfully” add a public URL,
Cloudflare DNS record, or screenshot of a demo that is not this repo.

## Rule

Grid stays **local** (`127.0.0.1:4318` / `:5318`) until it meets the Agent Fleet
quality bar:

1. Claimed features work on the critical path.
2. Tests cover those paths (see CI in the root README).
3. Docs are honest — status table, how to run, what was actually verified.
4. No invented demo metrics.

`GET /api/settings` always returns `studio.live: false` and `publicUrl: null`.

`DEMO_PUBLIC=1` (`pnpm demo`) is a **local** switch. Missing vendor CLIs open
an in-pane simulator. That flag does not create a hostname, does not set
`studio.live`, and does not talk to a model. Hosting notes, including a
single-operator Contabo SSH tunnel, are in [HOSTING.md](./HOSTING.md).

## What is not this task

- Changing Cloudflare DNS
- Adding a `grid.agentic-systems-studio.com` (or any) public hostname
- Copying Agent Fleet’s eval scores or uptime claims into this README

When (if) Grid is ready for a studio subdomain, that is a **separate**, explicit
change with a green CI run and an updated status table — not a drive-by in an
ADE bugfix.
