import { useCallback, useEffect, useState } from "react";
import type { FsEntry, FsFileContent } from "@agentgrid/shared";
import { api } from "../lib/http";


interface Props {
  initialRoot?: string;
}

export function FilesPanel({ initialRoot }: Props) {
  const [roots, setRoots] = useState<string[]>([]);
  const [root, setRoot] = useState(initialRoot ?? "");
  const [cwd, setCwd] = useState(".");
  const [entries, setEntries] = useState<FsEntry[]>([]);
  const [file, setFile] = useState<FsFileContent | null>(null);
  const [draft, setDraft] = useState("");
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState("");

  const loadTree = useCallback(async (nextRoot: string, nextCwd: string) => {
    const res = await api<{ entries: FsEntry[] }>(
      `/api/fs/tree?root=${encodeURIComponent(nextRoot)}&path=${encodeURIComponent(nextCwd)}`,
    );
    setEntries(res.entries);
  }, []);

  useEffect(() => {
    void (async () => {
      try {
        const res = await api<{ roots: string[] }>("/api/fs/roots");
        setRoots(res.roots);
        const r = initialRoot && res.roots.includes(initialRoot) ? initialRoot : res.roots[0] ?? "";
        setRoot(r);
        if (r) await loadTree(r, ".");
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      }
    })();
  }, [initialRoot, loadTree]);

  const openEntry = async (entry: FsEntry) => {
    if (!root) return;
    setError(null);
    if (entry.type === "dir") {
      setCwd(entry.path);
      setFile(null);
      setDirty(false);
      await loadTree(root, entry.path);
      return;
    }
    setBusy(true);
    try {
      const res = await api<{ file: FsFileContent }>(
        `/api/fs/file?root=${encodeURIComponent(root)}&path=${encodeURIComponent(entry.path)}`,
      );
      setFile(res.file);
      setDraft(res.file.content);
      setDirty(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const goUp = async () => {
    if (!root || cwd === "." || cwd === "") return;
    const parts = cwd.split("/").filter(Boolean);
    parts.pop();
    const next = parts.length ? parts.join("/") : ".";
    setCwd(next);
    setFile(null);
    await loadTree(root, next);
  };

  const save = async () => {
    if (!root || !file) return;
    setBusy(true);
    setError(null);
    try {
      const res = await api<{ file: FsFileContent }>("/api/fs/file", {
        method: "PUT",
        body: JSON.stringify({ root, path: file.path, content: draft }),
      });
      setFile(res.file);
      setDirty(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const visible = entries.filter((e) =>
    filter.trim() ? e.name.toLowerCase().includes(filter.trim().toLowerCase()) : true,
  );

  return (
    <div className="files-panel">
      <div className="files-toolbar">
        <select
          value={root}
          onChange={(e) => {
            const r = e.target.value;
            setRoot(r);
            setCwd(".");
            setFile(null);
            void loadTree(r, ".");
          }}
        >
          {roots.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
        <button type="button" className="secondary" onClick={() => void goUp()} disabled={cwd === "."}>
          Up
        </button>
        <input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Filter (quick find)"
        />
        <button type="button" className="primary" disabled={!dirty || busy || !file} onClick={() => void save()}>
          Save{dirty ? " *" : ""}
        </button>
      </div>
      {error && <pre className="error">{error}</pre>}
      <div className="files-body">
        <aside className="files-tree">
          <div className="files-cwd">{cwd}</div>
          {visible.map((e) => (
            <button
              key={e.path}
              type="button"
              className={file?.path === e.path ? "files-item active" : "files-item"}
              onClick={() => void openEntry(e)}
            >
              <span className="files-kind">{e.type === "dir" ? "DIR" : "FILE"}</span>
              {e.name}
            </button>
          ))}
        </aside>
        <section className="files-editor">
          {file ? (
            <>
              <div className="files-editor-path">
                {file.path}
                {file.truncated ? " (truncated)" : ""}
              </div>
              <textarea
                value={draft}
                onChange={(e) => {
                  setDraft(e.target.value);
                  setDirty(true);
                }}
                spellCheck={false}
              />
            </>
          ) : (
            <div className="empty-pane">Select a file to edit</div>
          )}
        </section>
      </div>
    </div>
  );
}
