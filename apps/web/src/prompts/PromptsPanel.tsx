import { useEffect, useState } from "react";
import type { PromptSpec, SessionInfo } from "@agentgrid/shared";
import { api } from "../lib/http";

interface Props {
  sessions: SessionInfo[];
  activeSessionId: string | null;
  busy?: boolean;
}

export function PromptsPanel({ sessions, activeSessionId, busy }: Props) {
  const [prompts, setPrompts] = useState<PromptSpec[]>([]);
  const [name, setName] = useState("");
  const [body, setBody] = useState("");
  const [sessionId, setSessionId] = useState(activeSessionId ?? "");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [working, setWorking] = useState(false);

  const refresh = async () => {
    const res = await api<{ prompts: PromptSpec[] }>("/api/prompts");
    setPrompts(res.prompts);
  };

  useEffect(() => {
    void refresh().catch((err) => setError(err instanceof Error ? err.message : String(err)));
  }, []);

  useEffect(() => {
    if (activeSessionId) setSessionId(activeSessionId);
  }, [activeSessionId]);

  const save = async () => {
    setWorking(true);
    setError(null);
    try {
      await api("/api/prompts", {
        method: "POST",
        body: JSON.stringify({ name: name.trim(), body }),
      });
      setName("");
      setBody("");
      await refresh();
      setMessage("Prompt saved");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setWorking(false);
    }
  };

  const apply = async (id: string) => {
    if (!sessionId) {
      setError("Select a running session first");
      return;
    }
    setWorking(true);
    setError(null);
    try {
      await api(`/api/prompts/${id}/apply`, {
        method: "POST",
        body: JSON.stringify({ sessionId }),
      });
      setMessage("Applied prompt to pane");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setWorking(false);
    }
  };

  const remove = async (id: string) => {
    setWorking(true);
    try {
      await api(`/api/prompts/${id}`, { method: "DELETE" });
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setWorking(false);
    }
  };

  return (
    <div className="prompts-panel">
      <div className="prompts-form">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Prompt name (e.g. Explain this file)"
        />
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Prompt body — injected into the target pane"
          rows={5}
        />
        <button
          type="button"
          className="primary"
          disabled={busy || working || !name.trim() || !body.trim()}
          onClick={() => void save()}
        >
          Save prompt
        </button>
      </div>

      <label className="field">
        <span>Target session</span>
        <select value={sessionId} onChange={(e) => setSessionId(e.target.value)}>
          <option value="">Select session…</option>
          {sessions.map((s) => (
            <option key={s.id} value={s.id}>
              {s.title} ({s.agentId})
            </option>
          ))}
        </select>
      </label>

      {error && <pre className="error">{error}</pre>}
      {message && <div className="skills-msg">{message}</div>}

      <div className="prompts-list">
        {prompts.length === 0 && <div className="empty">No saved prompts yet</div>}
        {prompts.map((p) => (
          <article key={p.id} className="prompt-card">
            <h3>{p.name}</h3>
            <pre className="prompt-body">{p.body}</pre>
            <div className="prompt-actions">
              <button
                type="button"
                className="primary"
                disabled={busy || working || !sessionId}
                onClick={() => void apply(p.id)}
              >
                Apply to pane
              </button>
              <button type="button" className="secondary" disabled={working} onClick={() => void remove(p.id)}>
                Delete
              </button>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
