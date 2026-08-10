import { useCallback, useEffect, useMemo, useState } from "react";
import Editor from "@monaco-editor/react";
import type { FsEntry, FsFileContent } from "@agentgrid/shared";
import { api } from "../lib/http";

interface Props {
  initialRoot?: string;
}

function languageForPath(path: string): string {
  const name = path.toLowerCase();
  if (name.endsWith(".ts") || name.endsWith(".tsx")) return "typescript";
  if (name.endsWith(".js") || name.endsWith(".jsx") || name.endsWith(".mjs") || name.endsWith(".cjs"))
    return "javascript";
  if (name.endsWith(".json")) return "json";
  if (name.endsWith(".md") || name.endsWith(".mdx")) return "markdown";
  if (name.endsWith(".css")) return "css";
  if (name.endsWith(".html") || name.endsWith(".htm")) return "html";
  if (name.endsWith(".rs")) return "rust";
  if (name.endsWith(".py")) return "python";
  if (name.endsWith(".yml") || name.endsWith(".yaml")) return "yaml";
  if (name.endsWith(".toml")) return "toml";
  if (name.endsWith(".sh") || name.endsWith(".zsh") || name.endsWith(".bash")) return "shell";
  return "plaintext";
}

/** Monaco theme names that roughly match our CSS themes. */
function monacoTheme(): string {
  const id = document.documentElement.dataset.theme;
  if (id === "amber") return "vs-dark";
  if (id === "contrast") return "hc-black";
  return "vs-dark";
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
  const [editorTheme, setEditorTheme] = useState(monacoTheme);

  const language = useMemo(
    () => (file ? languageForPath(file.path) : "plaintext"),
    [file],
  );

  useEffect(() => {
    const sync = () => setEditorTheme(monacoTheme());
    const obs = new MutationObserver(sync);
    obs.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });
    return () => obs.disconnect();
  }, []);

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
              <div className="files-monaco">
                <Editor
                  height="100%"
                  theme={editorTheme}
                  language={language}
                  value={draft}
                  path={file.path}
                  options={{
                    fontFamily: '"IBM Plex Mono", ui-monospace, monospace',
                    fontSize: 13,
                    minimap: { enabled: false },
                    wordWrap: "on",
                    scrollBeyondLastLine: false,
                    automaticLayout: true,
                    readOnly: Boolean(file.truncated),
                  }}
                  onChange={(value) => {
                    setDraft(value ?? "");
                    setDirty(true);
                  }}
                />
              </div>
            </>
          ) : (
            <div className="empty-pane">Select a file to edit</div>
          )}
        </section>
      </div>
    </div>
  );
}
