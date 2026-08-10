import { useEffect, useState } from "react";
import type { MemoryNote } from "@agentgrid/shared";

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
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export function MemoryPanel() {
  const [notes, setNotes] = useState<MemoryNote[]>([]);
  const [directory, setDirectory] = useState("");
  const [active, setActive] = useState<MemoryNote | null>(null);
  const [draft, setDraft] = useState("");
  const [title, setTitle] = useState("");
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = async () => {
    const res = await api<{ notes: MemoryNote[]; directory: string }>("/api/memory");
    setNotes(res.notes);
    setDirectory(res.directory);
  };

  useEffect(() => {
    void refresh().catch((err) => setError(err instanceof Error ? err.message : String(err)));
  }, []);

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
        body: JSON.stringify({ title: title.trim() || "Untitled note" }),
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
        body: JSON.stringify({ id: active.id, title, content: draft }),
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
      await api<void>(`/api/memory/${id}`, { method: "DELETE" });
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
