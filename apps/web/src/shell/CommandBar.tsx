import { useEffect, useState } from "react";
import type { SessionInfo } from "@agentgrid/shared";

interface Props {
  sessions: SessionInfo[];
  activeSessionId: string | null;
  busy?: boolean;
  onSend: (text: string, target: string) => Promise<void>;
}

export function CommandBar({ sessions, activeSessionId, busy, onSend }: Props) {
  const [text, setText] = useState("");
  const [target, setTarget] = useState(activeSessionId ?? "");
  const [error, setError] = useState<string | null>(null);
  const [working, setWorking] = useState(false);
  const [followFocus, setFollowFocus] = useState(true);

  useEffect(() => {
    if (!followFocus) return;
    if (activeSessionId) setTarget(activeSessionId);
  }, [activeSessionId, followFocus]);

  const submit = async () => {
    const body = text.trim();
    if (!body) return;
    setWorking(true);
    setError(null);
    try {
      await onSend(body, target || activeSessionId || "*");
      setText("");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setWorking(false);
    }
  };

  return (
    <div className="command-bar">
      <select
        className="command-target"
        value={target || activeSessionId || "*"}
        onChange={(e) => {
          setFollowFocus(false);
          setTarget(e.target.value);
        }}
        aria-label="Command target"
      >
        <option value="*">All panes</option>
        <option value="@coordinator">@coordinator</option>
        <option value="@builder">@builder</option>
        <option value="@scout">@scout</option>
        <option value="@reviewer">@reviewer</option>
        {sessions.map((s) => (
          <option key={s.id} value={s.id}>
            {s.title} ({s.agentId})
          </option>
        ))}
      </select>
      <input
        className="command-input"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Steer agents…  Enter to send"
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            void submit();
          }
        }}
      />
      <button
        type="button"
        className="primary"
        disabled={busy || working || !text.trim()}
        onClick={() => void submit()}
      >
        Send
      </button>
      {error && <span className="command-error">{error}</span>}
    </div>
  );
}
