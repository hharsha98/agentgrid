import { useCallback, useEffect, useRef, useState } from "react";
import { Terminal as XTerm } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { SearchAddon } from "@xterm/addon-search";
import { WebLinksAddon } from "@xterm/addon-web-links";
import { WebglAddon } from "@xterm/addon-webgl";
import type { ClientMessage, ServerMessage, SessionInfo } from "@agentgrid/shared";
import { CommandBlockTracker, type CommandBlock } from "./commandBlocks";
import { api, wsSessionUrl } from "../lib/http";
import { readXtermTheme } from "../lib/themes";
import "@xterm/xterm/css/xterm.css";

interface Props {
  sessionId: string;
  onReady?: (session: SessionInfo) => void;
  onExit?: (code: number | null) => void;
}

export function Terminal({ sessionId, onReady, onExit }: Props) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const termRef = useRef<XTerm | null>(null);
  const fitRef = useRef<FitAddon | null>(null);
  const searchRef = useRef<SearchAddon | null>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const trackerRef = useRef(new CommandBlockTracker());
  const [blocks, setBlocks] = useState<CommandBlock[]>([]);
  const [showBlocks, setShowBlocks] = useState(true);
  const [showSearch, setShowSearch] = useState(false);
  const [query, setQuery] = useState("");
  const [scrolledUp, setScrolledUp] = useState(false);
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);

  const send = useCallback((message: ClientMessage) => {
    const ws = socketRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }, []);

  useEffect(() => {
    const tracker = trackerRef.current;
    return tracker.subscribe(() => setBlocks([...tracker.list]));
  }, []);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const tracker = new CommandBlockTracker();
    trackerRef.current = tracker;
    const unsub = tracker.subscribe(() => setBlocks([...tracker.list]));

    const term = new XTerm({
      cursorBlink: true,
      fontFamily: '"IBM Plex Mono", ui-monospace, monospace',
      fontSize: 13,
      lineHeight: 1.25,
      theme: readXtermTheme(),
      allowProposedApi: true,
    });
    const fit = new FitAddon();
    const search = new SearchAddon();
    const links = new WebLinksAddon();
    term.loadAddon(fit);
    term.loadAddon(search);
    term.loadAddon(links);
    term.open(host);

    try {
      term.loadAddon(new WebglAddon());
    } catch {
      // Canvas renderer is fine as fallback
    }

    termRef.current = term;
    fitRef.current = fit;
    searchRef.current = search;
    fit.fit();

    const ws = new WebSocket(wsSessionUrl(sessionId));
    socketRef.current = ws;

    ws.onmessage = (ev) => {
      let msg: ServerMessage;
      try {
        msg = JSON.parse(String(ev.data)) as ServerMessage;
      } catch {
        return;
      }
      if (msg.type === "output") {
        const clean = tracker.feed(msg.data);
        term.write(clean);
      } else if (msg.type === "ready") {
        onReady?.(msg.session);
        fit.fit();
        send({ type: "resize", cols: term.cols, rows: term.rows });
      } else if (msg.type === "exit") {
        term.writeln(`\r\n\x1b[90m[process exited: ${msg.code ?? "null"}]\x1b[0m`);
        onExit?.(msg.code);
      } else if (msg.type === "error") {
        term.writeln(`\r\n\x1b[31m[error] ${msg.message}\x1b[0m`);
      }
    };

    const dataDisp = term.onData((data) => {
      tracker.noteInput(data);
      send({ type: "input", data });
    });

    const scrollDisp = term.onScroll(() => {
      const buf = term.buffer.active;
      const atBottom = buf.viewportY >= buf.baseY;
      setScrolledUp(!atBottom);
    });

    const onResize = () => {
      fit.fit();
      send({ type: "resize", cols: term.cols, rows: term.rows });
    };
    const ro = new ResizeObserver(onResize);
    ro.observe(host);
    window.addEventListener("resize", onResize);

    const onCtx = (e: MouseEvent) => {
      e.preventDefault();
      setMenu({ x: e.clientX, y: e.clientY });
    };
    host.addEventListener("contextmenu", onCtx);

    const onDrop = (e: DragEvent) => {
      e.preventDefault();
      const skillId = e.dataTransfer?.getData("application/x-agentgrid-skill");
      if (skillId) {
        void api(`/api/skills/${skillId}/apply`, {
          method: "POST",
          body: JSON.stringify({ sessionId }),
        }).catch(() => undefined);
        return;
      }
      const file = e.dataTransfer?.files?.[0];
      if (file) send({ type: "input", data: file.name });
    };
    const onDragOver = (e: DragEvent) => e.preventDefault();
    host.addEventListener("drop", onDrop);
    host.addEventListener("dragover", onDragOver);

    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "f") {
        // Only when this wrap contains focus
        if (!wrapRef.current?.contains(document.activeElement) && document.activeElement !== document.body) {
          return;
        }
        e.preventDefault();
        setShowSearch(true);
      }
      if (e.key === "Escape") {
        setShowSearch(false);
        setMenu(null);
      }
    };
    window.addEventListener("keydown", onKey);

    const syncTheme = () => {
      term.options.theme = readXtermTheme();
    };
    const themeObs = new MutationObserver(syncTheme);
    themeObs.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });

    return () => {
      themeObs.disconnect();
      unsub();
      dataDisp.dispose();
      scrollDisp.dispose();
      ro.disconnect();
      window.removeEventListener("resize", onResize);
      window.removeEventListener("keydown", onKey);
      host.removeEventListener("contextmenu", onCtx);
      host.removeEventListener("drop", onDrop);
      host.removeEventListener("dragover", onDragOver);
      ws.close();
      term.dispose();
      termRef.current = null;
      fitRef.current = null;
      searchRef.current = null;
      socketRef.current = null;
    };
  }, [sessionId, onReady, onExit, send]);

  const findNext = (reverse = false) => {
    if (!query.trim()) return;
    searchRef.current?.findNext(query, { incremental: true, regex: false, caseSensitive: false, decorations: undefined });
    if (reverse) searchRef.current?.findPrevious(query, { incremental: true, regex: false, caseSensitive: false });
  };

  return (
    <div className="terminal-wrap" ref={wrapRef}>
      <div className="blocks-bar">
        <button type="button" className="chip" onClick={() => setShowBlocks((v) => !v)}>
          {showBlocks ? "Hide blocks" : "Show blocks"}
        </button>
        <button type="button" className="chip" onClick={() => setShowSearch((v) => !v)}>
          Search
        </button>
        <span className="blocks-count">{blocks.length} commands</span>
      </div>
      {showSearch && (
        <div className="term-search">
          <input
            autoFocus
            value={query}
            placeholder="Find in terminal (⌘/Ctrl+F)"
            onChange={(e) => {
              setQuery(e.target.value);
              if (e.target.value) {
                searchRef.current?.findNext(e.target.value, {
                  incremental: true,
                  regex: false,
                  caseSensitive: false,
                });
              }
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                findNext(e.shiftKey);
              }
            }}
          />
          <button type="button" className="secondary" onClick={() => findNext(false)}>
            Next
          </button>
          <button type="button" className="secondary" onClick={() => findNext(true)}>
            Prev
          </button>
          <button type="button" className="secondary" onClick={() => setShowSearch(false)}>
            Close
          </button>
        </div>
      )}
      {showBlocks && blocks.length > 0 && (
        <div className="blocks-list">
          {blocks.map((b) => (
            <div key={b.id} className={`cmd-block status-${b.status}`}>
              <button
                type="button"
                className="cmd-block-head"
                onClick={() => trackerRef.current.toggle(b.id)}
              >
                <span
                  className={
                    b.exitCode === null
                      ? "exit running"
                      : b.exitCode === 0
                        ? "exit ok"
                        : "exit bad"
                  }
                >
                  {b.status === "running" ? "●" : b.exitCode === 0 ? "✓" : "✕"}
                </span>
                <code>{b.command}</code>
                <span className="exit-code">
                  {b.exitCode === null ? "…" : `exit ${b.exitCode}`}
                </span>
              </button>
              {!b.collapsed && b.output && (
                <pre className="cmd-block-out">{b.output}</pre>
              )}
            </div>
          ))}
        </div>
      )}
      <div className="terminal-host" ref={hostRef} />
      {scrolledUp && (
        <button
          type="button"
          className="scroll-bottom"
          onClick={() => termRef.current?.scrollToBottom()}
        >
          ↓ Jump to bottom
        </button>
      )}
      {menu && (
        <div
          className="term-ctx"
          style={{ position: "fixed", left: menu.x, top: menu.y, zIndex: 20 }}
        >
          <button
            type="button"
            className="secondary"
            onClick={() => {
              const sel = termRef.current?.getSelection();
              if (sel) void navigator.clipboard.writeText(sel);
              setMenu(null);
            }}
          >
            Copy selection
          </button>
          <button
            type="button"
            className="secondary"
            onClick={async () => {
              const text = await navigator.clipboard.readText();
              if (text) send({ type: "input", data: text });
              setMenu(null);
            }}
          >
            Paste
          </button>
          <button
            type="button"
            className="secondary"
            onClick={() => {
              termRef.current?.clear();
              setMenu(null);
            }}
          >
            Clear
          </button>
          <button type="button" className="secondary" onClick={() => setMenu(null)}>
            Close
          </button>
        </div>
      )}
    </div>
  );
}
