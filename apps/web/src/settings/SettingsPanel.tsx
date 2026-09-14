import { useEffect, useState } from "react";
import type { AgentAvailability, GridSettings } from "@agentgrid/shared";
import { api } from "../lib/http";

interface Props {
  agents: AgentAvailability[];
}

export function SettingsPanel({ agents }: Props) {
  const [settings, setSettings] = useState<GridSettings | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void api<GridSettings>("/api/settings")
      .then((s) => setSettings(s))
      .catch((err) => setError(err instanceof Error ? err.message : String(err)));
  }, []);

  const snippet = `{
  "mcpServers": {
    "agentgrid": {
      "command": "pnpm",
      "args": ["--filter", "@agentgrid/mcp", "start"],
      "cwd": "/absolute/path/to/agentgrid"
    }
  }
}`;

  return (
    <div className="settings-panel">
      <h2>Settings</h2>
      <p className="settings-lead">
        Local ADE for the Cursor lane. Nothing here is published as Live on
        agentic-systems-studio.com.
      </p>
      {error && <pre className="error">{error}</pre>}

      <section className="settings-card">
        <h3>Runtime</h3>
        {settings ? (
          <dl className="settings-dl">
            <dt>API</dt>
            <dd>
              127.0.0.1:{settings.ports.server} (web :{settings.ports.web})
            </dd>
            <dt>Data</dt>
            <dd>{settings.dataDir}</dd>
            <dt>File roots</dt>
            <dd>
              {settings.fsRoots.map((r) => (
                <div key={r}>
                  <code>{r}</code>
                </div>
              ))}
            </dd>
          </dl>
        ) : (
          <div className="empty">Loading…</div>
        )}
      </section>

      <section className="settings-card">
        <h3>Agents on PATH</h3>
        {agents.length === 0 && <div className="empty">Server offline — cannot detect CLIs</div>}
        <ul className="settings-agents">
          {agents.map((a) => (
            <li key={a.id}>
              <strong>{a.displayName}</strong>
              <span className={a.available ? "ok" : "missing"}>
                {a.available ? a.command : `missing — ${a.installHint}`}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className="settings-card">
        <h3>Shared memory MCP</h3>
        <p>
          STDIO server. Cursor and Claude Desktop speak Content-Length JSON-RPC; line-delimited
          JSON also works. Memory tools talk to <code>~/.agentgrid/memory</code> even if the
          Fastify API is down. Live tools (sessions, kanban, fs) need the API on :4318.
        </p>
        <pre className="settings-snippet">{snippet}</pre>
      </section>

      <section className="settings-card">
        <h3>What this is not</h3>
        <ul>
          <li>
            Not <strong>Vibespace</strong> — that is the separate desktop ADE with its own
            releases. Do not merge the repos.
          </li>
          <li>
            Not <strong>Agent Fleet</strong> — that is the multi-agent ops platform (chat, DAG,
            evals). Grid is a terminal grid for coding CLIs.
          </li>
          <li>
            Swarm is cooperative: it opens four PTY panes with role prompts. File ownership is
            not OS-enforced.
          </li>
          <li>
            Command blocks need the bundled zsh/bash integration. Plain <code>sh</code> will not
            emit OSC 133.
          </li>
        </ul>
      </section>
    </div>
  );
}
