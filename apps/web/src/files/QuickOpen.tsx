import { useEffect, useState } from "react";
import type { FsEntry } from "@agentgrid/shared";
import { api } from "../lib/http";

interface Props {
  open: boolean;
  root?: string;
  onClose: () => void;
  onOpen: (entry: FsEntry, root: string) => void;
}

export function QuickOpen({ open, root, onClose, onOpen }: Props) {
  const [query, setQuery] = useState("");
  const [entries, setEntries] = useState<FsEntry[]>([]);
  const [activeRoot, setActiveRoot] = useState(root ?? "");
  const [roots, setRoots] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    if (!open) return;
    void (async () => {
      try {
        const res = await api<{ roots: string[] }>("/api/fs/roots");
        setRoots(res.roots);
        setActiveRoot((prev) => prev || root || res.roots[0] || "");
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      }
    })();
  }, [open, root]);

  useEffect(() => {
    if (!open || !activeRoot) return;
    if (!query.trim()) {
      setEntries([]);
      return;
    }
    const t = window.setTimeout(() => {
      void api<{ entries: FsEntry[] }>(
        `/api/fs/search?root=${encodeURIComponent(activeRoot)}&q=${encodeURIComponent(query.trim())}`,
      )
        .then((res) => {
          setEntries(res.entries);
          setIdx(0);
          setError(null);
        })
        .catch((err) => setError(err instanceof Error ? err.message : String(err)));
    }, 120);
    return () => window.clearTimeout(t);
  }, [query, activeRoot, open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="quick-open-backdrop" onClick={onClose}>
      <div
        className="quick-open"
        role="dialog"
        aria-label="Quick Open"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="quick-open-bar">
          <select value={activeRoot} onChange={(e) => setActiveRoot(e.target.value)}>
            {roots.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
          <input
            autoFocus
            value={query}
            placeholder="Quick Open — type a file name (⌘P)"
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setIdx((i) => Math.min(entries.length - 1, i + 1));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setIdx((i) => Math.max(0, i - 1));
              } else if (e.key === "Enter") {
                e.preventDefault();
                const hit = entries[idx];
                if (hit && hit.type === "file") {
                  onOpen(hit, activeRoot);
                  onClose();
                }
              }
            }}
          />
        </div>
        {error && <pre className="error">{error}</pre>}
        <div className="quick-open-list">
          {query.trim() && entries.length === 0 && (
            <div className="empty">No matches</div>
          )}
          {entries.map((e, i) => (
            <button
              key={e.path}
              type="button"
              className={i === idx ? "quick-open-item active" : "quick-open-item"}
              onMouseEnter={() => setIdx(i)}
              onClick={() => {
                if (e.type === "file") {
                  onOpen(e, activeRoot);
                  onClose();
                }
              }}
            >
              <span className="files-kind">{e.type === "dir" ? "DIR" : "FILE"}</span>
              <span>{e.path}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
