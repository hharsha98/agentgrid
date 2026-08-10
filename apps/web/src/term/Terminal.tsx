import { useCallback, useEffect, useRef } from "react";
import { Terminal as XTerm } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { SearchAddon } from "@xterm/addon-search";
import { WebLinksAddon } from "@xterm/addon-web-links";
import { WebglAddon } from "@xterm/addon-webgl";
import type { ClientMessage, ServerMessage, SessionInfo } from "@agentgrid/shared";
import "@xterm/xterm/css/xterm.css";

interface Props {
  sessionId: string;
  onReady?: (session: SessionInfo) => void;
  onExit?: (code: number | null) => void;
}

function wsUrl(sessionId: string): string {
  const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${proto}//${window.location.host}/api/sessions/${sessionId}/ws`;
}

export function Terminal({ sessionId, onReady, onExit }: Props) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const termRef = useRef<XTerm | null>(null);
  const fitRef = useRef<FitAddon | null>(null);
  const socketRef = useRef<WebSocket | null>(null);

  const send = useCallback((message: ClientMessage) => {
    const ws = socketRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }, []);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const term = new XTerm({
      cursorBlink: true,
      fontFamily: '"IBM Plex Mono", ui-monospace, monospace',
      fontSize: 13,
      lineHeight: 1.25,
      theme: {
        background: "#0a0f0d",
        foreground: "#e8f0eb",
        cursor: "#3dcf8e",
        selectionBackground: "#1a5c3f",
      },
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
    fit.fit();

    const ws = new WebSocket(wsUrl(sessionId));
    socketRef.current = ws;

    ws.onmessage = (ev) => {
      let msg: ServerMessage;
      try {
        msg = JSON.parse(String(ev.data)) as ServerMessage;
      } catch {
        return;
      }
      if (msg.type === "output") {
        term.write(msg.data);
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

    const dataDisp = term.onData((data) => send({ type: "input", data }));

    const onResize = () => {
      fit.fit();
      send({ type: "resize", cols: term.cols, rows: term.rows });
    };
    const ro = new ResizeObserver(onResize);
    ro.observe(host);
    window.addEventListener("resize", onResize);

    const onCtx = (e: MouseEvent) => {
      e.preventDefault();
      const sel = term.getSelection();
      if (sel) {
        void navigator.clipboard.writeText(sel);
      }
    };
    host.addEventListener("contextmenu", onCtx);

    const onDrop = (e: DragEvent) => {
      e.preventDefault();
      const file = e.dataTransfer?.files?.[0];
      if (file) {
        // File path is not available in browsers; paste the name as a hint.
        send({ type: "input", data: file.name });
      }
    };
    const onDragOver = (e: DragEvent) => e.preventDefault();
    host.addEventListener("drop", onDrop);
    host.addEventListener("dragover", onDragOver);

    return () => {
      dataDisp.dispose();
      ro.disconnect();
      window.removeEventListener("resize", onResize);
      host.removeEventListener("contextmenu", onCtx);
      host.removeEventListener("drop", onDrop);
      host.removeEventListener("dragover", onDragOver);
      ws.close();
      term.dispose();
      termRef.current = null;
      fitRef.current = null;
      socketRef.current = null;
    };
  }, [sessionId, onReady, onExit, send]);

  return <div className="terminal-host" ref={hostRef} />;
}
