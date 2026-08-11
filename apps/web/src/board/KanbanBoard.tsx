import { useState } from "react";
import type { AgentId, KanbanCard, KanbanColumn, SessionInfo } from "@agentgrid/shared";

const COLUMNS: { id: KanbanColumn; label: string }[] = [
  { id: "todo", label: "Todo" },
  { id: "in_progress", label: "In Progress" },
  { id: "in_review", label: "In Review" },
  { id: "done", label: "Done" },
];

interface Props {
  cards: KanbanCard[];
  sessions?: SessionInfo[];
  agents: { id: AgentId; displayName: string; available: boolean }[];
  busy?: boolean;
  onCreate: (title: string, agentId: AgentId, body?: string) => void;
  onMove: (id: string, column: KanbanColumn) => void;
  onDispatch: (id: string) => void;
  onDelete: (id: string) => void;
}

export function KanbanBoard({
  cards,
  sessions = [],
  agents,
  busy,
  onCreate,
  onMove,
  onDispatch,
  onDelete,
}: Props) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [agentId, setAgentId] = useState<AgentId>("claude");
  const [dragOver, setDragOver] = useState<KanbanColumn | null>(null);

  const submit = () => {
    if (!title.trim()) return;
    onCreate(title.trim(), agentId, body.trim() || undefined);
    setTitle("");
    setBody("");
  };

  return (
    <div className="kanban">
      <div className="kanban-new">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="New task title"
          onKeyDown={(e) => {
            if (e.key === "Enter" && title.trim()) submit();
          }}
        />
        <input
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Optional details / prompt for the agent"
        />
        <select value={agentId} onChange={(e) => setAgentId(e.target.value as AgentId)}>
          {agents.map((a) => (
            <option key={a.id} value={a.id} disabled={!a.available}>
              {a.displayName}
            </option>
          ))}
        </select>
        <button type="button" className="primary" disabled={busy || !title.trim()} onClick={submit}>
          Add card
        </button>
      </div>

      <div className="kanban-columns">
        {COLUMNS.map((col) => (
          <section
            key={col.id}
            className={dragOver === col.id ? "kanban-col drag-over" : "kanban-col"}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(col.id);
            }}
            onDragLeave={() => setDragOver((c) => (c === col.id ? null : c))}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(null);
              const id = e.dataTransfer.getData("application/x-agentgrid-card");
              if (id) onMove(id, col.id);
            }}
          >
            <header>{col.label}</header>
            <div className="kanban-cards">
              {cards
                .filter((c) => c.column === col.id)
                .map((c) => (
                  <article
                    key={c.id}
                    className="kanban-card"
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData("application/x-agentgrid-card", c.id);
                      e.dataTransfer.effectAllowed = "move";
                    }}
                  >
                    <div className="kanban-card-title">{c.title}</div>
                    {c.body && <div className="kanban-card-body">{c.body}</div>}
                    <div className="kanban-card-meta">
                      {c.agentId}
                      {c.sessionId
                        ? ` · ${sessions.find((s) => s.id === c.sessionId)?.title ?? c.sessionId.slice(0, 8)}`
                        : ""}
                    </div>
                    <div className="kanban-card-actions">
                      {(col.id === "todo" || col.id === "in_progress") && (
                        <button type="button" disabled={busy} onClick={() => onDispatch(c.id)}>
                          Dispatch
                        </button>
                      )}
                      <button type="button" disabled={busy} onClick={() => onDelete(c.id)}>
                        Delete
                      </button>
                    </div>
                  </article>
                ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
