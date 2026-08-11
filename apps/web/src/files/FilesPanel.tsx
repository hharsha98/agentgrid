import { useCallback, useEffect, useMemo, useState } from "react";
import Editor from "@monaco-editor/react";
import type { FsEntry, FsFileContent } from "@agentgrid/shared";
import { api } from "../lib/http";

interface Props {
  initialRoot?: string;
  /** Compact dock mode: still shows tree + editor beside the grid. */
  dock?: boolean;
  openPath?: { root: string; path: string } | null;
}

function TreeEntry({
  entry,
  depth,
  root,
  activePath,
  expanded,
  onToggleDir,
  onOpenFile,
}: {
  entry: FsEntry;
  depth: number;
  root: string;
  activePath: string | null;
  expanded: Record<string, FsEntry[]>;
  onToggleDir: (path: string) => void;
  onOpenFile: (entry: FsEntry) => void;
}) {
  const isDir = entry.type === "dir";
  const kids = expanded[entry.path];
  const open = Boolean(kids);

  return (
    <div>
      <button
        type="button"
        className={activePath === entry.path ? "files-item active" : "files-item"}
        style={{ paddingLeft: `${8 + depth * 12}px` }}
        draggable={!isDir}
        onDragStart={(ev) => {
          if (isDir) return;
          const abs = root.endsWith("/") ? `${root}${entry.path}` : `${root}/${entry.path}`;
          ev.dataTransfer.setData("application/x-agentgrid-path", abs);
          ev.dataTransfer.setData("text/plain", abs);
          ev.dataTransfer.effectAllowed = "copy";
        }}
        onClick={() => {
          if (isDir) onToggleDir(entry.path);
          else onOpenFile(entry);
        }}
      >
        <span className="files-kind">{isDir ? (open ? "▾" : "▸") : "FILE"}</span>
        {entry.name}
      </button>
      {open &&
        kids!.map((child) => (
          <TreeEntry
            key={child.path}
            entry={child}
            depth={depth + 1}
            root={root}
            activePath={activePath}
            expanded={expanded}
            onToggleDir={onToggleDir}
            onOpenFile={onOpenFile}
          />
        ))}
    </div>
  );
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

export function FilesPanel({ initialRoot, dock, openPath }: Props) {
  const [roots, setRoots] = useState<string[]>([]);
  const [root, setRoot] = useState(initialRoot ?? "");
  const [cwd, setCwd] = useState(".");
  const [entries, setEntries] = useState<FsEntry[]>([]);
  const [file, setFile] = useState<FsFileContent | null>(null);
  const [tabs, setTabs] = useState<FsFileContent[]>([]);
  const [draft, setDraft] = useState("");
  const [dirty, setDirty] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, FsEntry[]>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState("");
  const [editorTheme, setEditorTheme] = useState(monacoTheme);
  const [mtimeMs, setMtimeMs] = useState<number | null>(null);
  const [stale, setStale] = useState(false);

  const language = useMemo(
    () => (file ? languageForPath(file.path) : "plaintext"),
    [file],
  );

  useEffect(() => {
    if (!root || !file || dirty) return;
    const tick = async () => {
      try {
        const st = await api<{ stat: { mtimeMs: number } }>(
          `/api/fs/stat?root=${encodeURIComponent(root)}&path=${encodeURIComponent(file.path)}`,
        );
        if (mtimeMs != null && st.stat.mtimeMs > mtimeMs + 1) {
          if (!dirty) {
            const res = await api<{ file: import("@agentgrid/shared").FsFileContent }>(
              `/api/fs/file?root=${encodeURIComponent(root)}&path=${encodeURIComponent(file.path)}`,
            );
            setFile(res.file);
            setDraft(res.file.content);
            setMtimeMs(st.stat.mtimeMs);
            setStale(false);
          } else {
            setStale(true);
          }
        }
      } catch {
        // ignore
      }
    };
    const id = window.setInterval(() => void tick(), 2000);
    return () => window.clearInterval(id);
  }, [root, file, dirty, mtimeMs]);

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
      setTabs((prev) => {
        if (prev.some((t) => t.path === res.file.path)) {
          return prev.map((t) => (t.path === res.file.path ? res.file : t));
        }
        return [...prev, res.file];
      });
      setDraft(res.file.content);
      setDirty(false);
      setStale(false);
      try {
        const st = await api<{ stat: { mtimeMs: number } }>(
          `/api/fs/stat?root=${encodeURIComponent(root)}&path=${encodeURIComponent(entry.path)}`,
        );
        setMtimeMs(st.stat.mtimeMs);
      } catch {
        setMtimeMs(null);
      }
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

  useEffect(() => {
    if (!openPath || !openPath.path) return;
    setRoot(openPath.root);
    void (async () => {
      try {
        const res = await api<{ file: FsFileContent }>(
          `/api/fs/file?root=${encodeURIComponent(openPath.root)}&path=${encodeURIComponent(openPath.path)}`,
        );
        setFile(res.file);
        setTabs((prev) => {
          if (prev.some((t) => t.path === res.file.path)) {
            return prev.map((t) => (t.path === res.file.path ? res.file : t));
          }
          return [...prev, res.file];
        });
        setDraft(res.file.content);
        setDirty(false);
        setStale(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      }
    })();
  }, [openPath?.root, openPath?.path]);

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

  const toggleDir = (path: string) => {
    if (expanded[path]) {
      setExpanded((prev) => {
        const next = { ...prev };
        delete next[path];
        return next;
      });
      return;
    }
    void api<{ entries: FsEntry[] }>(
      `/api/fs/tree?root=${encodeURIComponent(root)}&path=${encodeURIComponent(path)}`,
    ).then((res) => setExpanded((prev) => ({ ...prev, [path]: res.entries })));
  };

  return (
    <div className={dock ? "files-panel dock" : "files-panel"}>
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
            <TreeEntry
              key={e.path}
              entry={e}
              depth={0}
              root={root}
              activePath={file?.path ?? null}
              expanded={expanded}
              onToggleDir={toggleDir}
              onOpenFile={(entry) => void openEntry(entry)}
            />
          ))}
        </aside>
        <section className="files-editor">
          {tabs.length > 0 && (
            <div className="files-tabs">
              {tabs.map((t) => (
                <button
                  key={t.path}
                  type="button"
                  className={file?.path === t.path ? "files-tab active" : "files-tab"}
                  onClick={() => {
                    setFile(t);
                    setDraft(t.content);
                    setDirty(false);
                    setStale(false);
                  }}
                >
                  {t.path.split("/").pop()}
                  <span
                    className="files-tab-x"
                    onClick={(ev) => {
                      ev.stopPropagation();
                      setTabs((prev) => prev.filter((x) => x.path !== t.path));
                      if (file?.path === t.path) {
                        const rest = tabs.filter((x) => x.path !== t.path);
                        const next = rest[rest.length - 1] ?? null;
                        setFile(next);
                        setDraft(next?.content ?? "");
                        setDirty(false);
                      }
                    }}
                  >
                    ×
                  </span>
                </button>
              ))}
            </div>
          )}
          {file ? (
            <>
              <div className="files-editor-path">
                {file.path}
                {file.truncated ? " (truncated)" : ""}
              </div>
              {stale && (
                <div className="files-stale">
                  File changed on disk.{" "}
                  <button
                    type="button"
                    className="secondary"
                    onClick={() => {
                      void openEntry({
                        name: file.path.split("/").pop() || file.path,
                        path: file.path,
                        type: "file",
                      });
                    }}
                  >
                    Reload
                  </button>
                </div>
              )}
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
