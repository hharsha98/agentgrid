import { useEffect, useState } from "react";
import type { SessionInfo, SkillSpec } from "@agentgrid/shared";

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = (await res.json()) as { error?: string };
      detail = body.error ?? detail;
    } catch {
      // ignore
    }
    throw new Error(detail);
  }
  return (await res.json()) as T;
}

interface Props {
  sessions: SessionInfo[];
  activeSessionId: string | null;
  busy?: boolean;
  onApplied?: () => void;
}

export function SkillsPanel({ sessions, activeSessionId, busy, onApplied }: Props) {
  const [skills, setSkills] = useState<SkillSpec[]>([]);
  const [sessionId, setSessionId] = useState(activeSessionId ?? "");
  const [error, setError] = useState<string | null>(null);
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    void api<{ skills: SkillSpec[] }>("/api/skills")
      .then((res) => setSkills(res.skills))
      .catch((err) => setError(err instanceof Error ? err.message : String(err)));
  }, []);

  useEffect(() => {
    if (activeSessionId) setSessionId(activeSessionId);
  }, [activeSessionId]);

  const apply = async (skillId: string) => {
    if (!sessionId) {
      setError("Select a running session first");
      return;
    }
    setWorking(true);
    setError(null);
    setMessage(null);
    try {
      const res = await api<{ skill: { name: string } }>(`/api/skills/${skillId}/apply`, {
        method: "POST",
        body: JSON.stringify({ sessionId }),
      });
      setMessage(`Applied “${res.skill.name}” to session`);
      onApplied?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setWorking(false);
    }
  };

  return (
    <div className="skills-panel">
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
      <div className="skills-grid">
        {skills.map((skill) => (
          <article key={skill.id} className="skill-card">
            <h3>{skill.name}</h3>
            <p>{skill.description}</p>
            <button
              type="button"
              className="primary"
              disabled={busy || working || !sessionId}
              onClick={() => void apply(skill.id)}
            >
              Apply to pane
            </button>
          </article>
        ))}
      </div>
    </div>
  );
}
