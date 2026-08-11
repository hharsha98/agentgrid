import { useEffect, useState } from "react";
import type { MemoryNote } from "@agentgrid/shared";
import { api } from "../lib/http";


interface Props {
  cwd?: string;
}

export function MemoryPanel({ cwd }: Props) {
  const [notes, setNotes] = useState<MemoryNote[]>([]);
  const [directory, setDirectory] = useState("");
  const [active, setActive] = useState<MemoryNote | null>(null);
  const [draft, setDraft] = useState("");
  const [title, setTitle] = useState("");
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [links, setLinks] = useState<{ from: string; to: string }[]>([])

  const refresh = async () => {
    const q = cwd ? `?cwd=${encodeURIComponent(cwd)}` : "";
    const res = await api<{ notes: MemoryNote[]; directory: string; links?: { from: string; to: string }[] }>(`/api/memory${q}`);
    setNotes(res.notes);
    setDirectory(res.directory);
    setLinks(res.links ?? []);
  };

  useEffect(() => {
    void refresh().catch((err) => setError(err instanceof Error ? err.message : String(err)));
  }, [cwd]);

  const open = (note: MemoryNote) => {
    setActive(note);
    setDraft(note.content);
    setTitle(note.title);
    setDirty(false);
  };

  const create = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await api<{ note: MemoryNote }>("/api/memory", {
        method: "POST",
        body: JSON.stringify({ title: title.trim() || "Untitled note", cwd }),
      });
      await refresh();
      open(res.note);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const save = async () => {
    if (!active) return;
    setBusy(true);
    setError(null);
    try {
      const res = await api<{ note: MemoryNote }>("/api/memory", {
        method: "POST",
        body: JSON.stringify({ id: active.id, title, content: draft, cwd }),
      });
      setActive(res.note);
      setDirty(false);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string) => {
    setBusy(true);
    try {
      await api<void>(`/api/memory/${id}${cwd ? `?cwd=${encodeURIComponent(cwd)}` : ""}`, { method: "DELETE" });
      if (active?.id === id) {
        setActive(null);
        setDraft("");
      }
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="memory-panel">
      <div className="memory-toolbar">
        <input
          value={title}
          onChange={(e) => {
            setTitle(e.target.value);
            setDirty(true);
          }}
          placeholder="Note title"
        />
        <button type="button" className="secondary" disabled={busy} onClick={() => void create()}>
          New note
        </button>
        <button type="button" className="primary" disabled={busy || !active || !dirty} onClick={() => void save()}>
          Save{dirty ? " *" : ""}
        </button>
      </div>
      <div className="memory-dir">{directory || "…"}</div>
      {links.length > 0 && (
        <div className="memory-links">
          {links.map((l, i) => (
            <div key={i} className="session-meta">
              [[{l.from}]] → [[{l.to}]]
            </div>
          ))}
        </div>
      )}
      {error && <pre className="error">{error}</pre>}
      <div className="memory-body">
        <aside className="memory-list">
          {notes.length === 0 && <div className="empty">No shared notes yet</div>}
          {notes.map((n) => (
            <div key={n.id} className={active?.id === n.id ? "memory-item active" : "memory-item"}>
              <button type="button" className="memory-open" onClick={() => open(n)}>
                {n.title}
              </button>
              <button type="button" className="template-del" onClick={() => void remove(n.id)}>
                ×
              </button>
            </div>
          ))}
        </aside>
        <section className="memory-editor">
          {active ? (
            <textarea
              value={draft}
              onChange={(e) => {
                setDraft(e.target.value);
                setDirty(true);
              }}
              spellCheck={false}
            />
          ) : (
            <div className="empty-pane">Shared memory — notes every agent can reuse</div>
          )}
        </section>
      </div>
    </div>
  );
}
