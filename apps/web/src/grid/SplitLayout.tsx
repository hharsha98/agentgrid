import { useCallback, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from "react";
import type { SessionInfo } from "@agentgrid/shared";
import { Terminal } from "../term/Terminal";
import type { PaneNode, SplitDirection } from "./splitTree";
import { assignSession, setRatio, splitLeaf } from "./splitTree";

interface Props {
  tree: PaneNode;
  sessions: SessionInfo[];
  activeId: string | null;
  onChange: (next: PaneNode) => void;
  onFocus: (sessionId: string) => void;
  onSkillDrop?: (skillId: string, sessionId: string) => void;
}

function sessionById(sessions: SessionInfo[], id: string | null) {
  if (!id) return null;
  return sessions.find((s) => s.id === id) ?? null;
}

export function SplitLayout({
  tree,
  sessions,
  activeId,
  onChange,
  onFocus,
  onSkillDrop,
}: Props) {
  return (
    <div className="split-root">
      <NodeView
        node={tree}
        sessions={sessions}
        activeId={activeId}
        onChange={onChange}
        root={tree}
        onFocus={onFocus}
        onSkillDrop={onSkillDrop}
      />
    </div>
  );
}

function NodeView({
  node,
  sessions,
  activeId,
  onChange,
  root,
  onFocus,
  onSkillDrop,
}: {
  node: PaneNode;
  sessions: SessionInfo[];
  activeId: string | null;
  onChange: (next: PaneNode) => void;
  root: PaneNode;
  onFocus: (sessionId: string) => void;
  onSkillDrop?: (skillId: string, sessionId: string) => void;
}) {
  if (node.type === "leaf") {
    const session = sessionById(sessions, node.sessionId);
    return (
      <section
        className={session && session.id === activeId ? "pane focused" : "pane"}
        onClick={() => session && onFocus(session.id)}
        onDragOver={(e) => {
          if ([...e.dataTransfer.types].includes("application/x-agentgrid-skill")) {
            e.preventDefault();
            e.currentTarget.classList.add("skill-drop-hover");
          }
        }}
        onDragLeave={(e) => e.currentTarget.classList.remove("skill-drop-hover")}
        onDrop={(e) => {
          e.preventDefault();
          e.currentTarget.classList.remove("skill-drop-hover");
          const skillId = e.dataTransfer.getData("application/x-agentgrid-skill");
          if (skillId && session) onSkillDrop?.(skillId, session.id);
        }}
      >
        <header className="pane-bar">
          <span>{session ? session.title : "Empty pane"}</span>
          <span className="pane-actions">
            {session && <span className="pane-agent">{session.agentId}</span>}
            <button
              type="button"
              className="chip"
              title="Split horizontally"
              onClick={(e) => {
                e.stopPropagation();
                onChange(splitLeaf(root, node.id, "row"));
              }}
            >
              H
            </button>
            <button
              type="button"
              className="chip"
              title="Split vertically"
              onClick={(e) => {
                e.stopPropagation();
                onChange(splitLeaf(root, node.id, "col"));
              }}
            >
              V
            </button>
            <select
              className="pane-assign"
              value={node.sessionId ?? ""}
              onClick={(e) => e.stopPropagation()}
              onChange={(e) => {
                onChange(assignSession(root, node.id, e.target.value || null));
              }}
            >
              <option value="">—</option>
              {sessions.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.title}
                </option>
              ))}
            </select>
          </span>
        </header>
        <div className="pane-body">
          {session ? (
            <Terminal sessionId={session.id} />
          ) : (
            <div className="empty-pane">Assign a session or launch a pane</div>
          )}
        </div>
      </section>
    );
  }

  return (
    <SplitView
      node={node}
      sessions={sessions}
      activeId={activeId}
      onChange={onChange}
      root={root}
      onFocus={onFocus}
      onSkillDrop={onSkillDrop}
    />
  );
}

function SplitView({
  node,
  sessions,
  activeId,
  onChange,
  root,
  onFocus,
  onSkillDrop,
}: {
  node: Extract<PaneNode, { type: "split" }>;
  sessions: SessionInfo[];
  activeId: string | null;
  onChange: (next: PaneNode) => void;
  root: PaneNode;
  onFocus: (sessionId: string) => void;
  onSkillDrop?: (skillId: string, sessionId: string) => void;
}) {
  const boxRef = useRef<HTMLDivElement | null>(null);
  const [dragging, setDragging] = useState(false);

  const onPointerDown = useCallback(
    (e: ReactPointerEvent) => {
      e.preventDefault();
      const box = boxRef.current;
      if (!box) return;
      setDragging(true);
      const dir: SplitDirection = node.direction;
      const start = dir === "row" ? e.clientY : e.clientX;
      const rect = box.getBoundingClientRect();
      const size = dir === "row" ? rect.height : rect.width;
      const originRatio = node.ratio;

      const move = (ev: PointerEvent) => {
        const delta = (dir === "row" ? ev.clientY : ev.clientX) - start;
        const next = originRatio + delta / size;
        onChange(setRatio(root, node.id, next));
      };
      const up = () => {
        setDragging(false);
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", up);
      };
      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", up);
    },
    [node, onChange, root],
  );

  const style: CSSProperties =
    node.direction === "row"
      ? {
          display: "grid",
          gridTemplateRows: `${node.ratio}fr 6px ${1 - node.ratio}fr`,
          gridTemplateColumns: "1fr",
          height: "100%",
          minHeight: 0,
        }
      : {
          display: "grid",
          gridTemplateColumns: `${node.ratio}fr 6px ${1 - node.ratio}fr`,
          gridTemplateRows: "1fr",
          height: "100%",
          minHeight: 0,
        };

  return (
    <div className={dragging ? "split-box dragging" : "split-box"} ref={boxRef} style={style}>
      <NodeView
        node={node.a}
        sessions={sessions}
        activeId={activeId}
        onChange={onChange}
        root={root}
        onFocus={onFocus}
        onSkillDrop={onSkillDrop}
      />
      <div
        className={node.direction === "row" ? "split-handle row" : "split-handle col"}
        onPointerDown={onPointerDown}
        role="separator"
        aria-orientation={node.direction === "row" ? "horizontal" : "vertical"}
      />
      <NodeView
        node={node.b}
        sessions={sessions}
        activeId={activeId}
        onChange={onChange}
        root={root}
        onFocus={onFocus}
        onSkillDrop={onSkillDrop}
      />
    </div>
  );
}
