import { useState } from "react";
import type { AgentId, KanbanCard, KanbanColumn } from "@agentgrid/shared";

const COLUMNS: { id: KanbanColumn; label: string }[] = [
  { id: "todo", label: "Todo" },
  { id: "in_progress", label: "In Progress" },
  { id: "in_review", label: "In Review" },
  { id: "done", label: "Done" },
];

interface Props {
  cards: KanbanCard[];
  agents: { id: AgentId; displayName: string; available: boolean }[];
  busy?: boolean;
  onCreate: (title: string, agentId: AgentId) => void;
  onMove: (id: string, column: KanbanColumn) => void;
  onDispatch: (id: string) => void;
  onDelete: (id: string) => void;
}

export function KanbanBoard({
  cards,
  agents,
  busy,
  onCreate,
  onMove,
  onDispatch,
  onDelete,
}: Props) {
  const [title, setTitle] = useState("");
  const [agentId, setAgentId] = useState<AgentId>("claude");

  return (
    <div className="kanban">
      <div className="kanban-new">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="New task title"
          onKeyDown={(e) => {
            if (e.key === "Enter" && title.trim()) {
              onCreate(title.trim(), agentId);
              setTitle("");
            }
          }}
        />
        <select value={agentId} onChange={(e) => setAgentId(e.target.value as AgentId)}>
          {agents.map((a) => (
            <option key={a.id} value={a.id} disabled={!a.available}>
              {a.displayName}
            </option>
          ))}
        </select>
        <button
          type="button"
          className="primary"
          disabled={busy || !title.trim()}
          onClick={() => {
            if (!title.trim()) return;
            onCreate(title.trim(), agentId);
            setTitle("");
          }}
        >
          Add card
        </button>
      </div>

      <div className="kanban-columns">
        {COLUMNS.map((col) => (
          <section key={col.id} className="kanban-col">
            <header>{col.label}</header>
            <div className="kanban-cards">
              {cards
                .filter((c) => c.column === col.id)
                .map((c) => (
                  <article key={c.id} className="kanban-card">
                    <div className="kanban-card-title">{c.title}</div>
                    {c.body && <div className="kanban-card-body">{c.body}</div>}
                    <div className="kanban-card-meta">{c.agentId}</div>
                    <div className="kanban-card-actions">
                      {col.id === "todo" && (
                        <button type="button" disabled={busy} onClick={() => onDispatch(c.id)}>
                          Dispatch
                        </button>
                      )}
                      {COLUMNS.filter((x) => x.id !== col.id).map((x) => (
                        <button
                          key={x.id}
                          type="button"
                          disabled={busy}
                          onClick={() => onMove(c.id, x.id)}
                        >
                          → {x.label}
                        </button>
                      ))}
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
