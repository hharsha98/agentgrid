import { useEffect, useState } from "react";
import type {
  SwarmMission,
  SwarmPlanNode,
  SwarmPlanStatus,
  SwarmRole,
} from "@agentgrid/shared";
import { api } from "../lib/http";

interface Props {
  busy?: boolean;
  cwd?: string;
  onLaunched?: (swarm: SwarmMission) => void;
}

const ROLES: Array<SwarmRole | ""> = ["", "coordinator", "builder", "scout", "reviewer"];

function PlanNodeView({
  node,
  depth,
  working,
  collapsed,
  onToggle,
  onStatus,
  onAddChild,
}: {
  node: SwarmPlanNode;
  depth: number;
  working: boolean;
  collapsed: Record<string, boolean>;
  onToggle: (id: string) => void;
  onStatus: (nodeId: string, status: SwarmPlanStatus) => void;
  onAddChild: (nodeId: string) => void;
}) {
  const kids = node.children ?? [];
  const isCollapsed = Boolean(collapsed[node.id]);
  const hasKids = kids.length > 0;

  return (
    <div className={`mission-node depth-${Math.min(depth, 4)}`}>
      <div className="mission-node-row">
        {hasKids ? (
          <button
            type="button"
            className="mission-twist"
            onClick={() => onToggle(node.id)}
            aria-label={isCollapsed ? "Expand" : "Collapse"}
          >
            {isCollapsed ? "▸" : "▾"}
          </button>
        ) : (
          <span className="mission-twist spacer" aria-hidden>
            ·
          </span>
        )}
        <span className={`mission-status status-${node.status}`} title={node.status}>
          {node.status === "done" ? "●" : node.status === "doing" ? "◉" : "○"}
        </span>
        <span className="mission-title">{node.title}</span>
        {node.role && <span className="session-meta">{node.role}</span>}
      </div>
      <div className="mission-node-actions">
        {(["pending", "doing", "done"] as SwarmPlanStatus[]).map((s) => (
          <button
            key={s}
            type="button"
            className={node.status === s ? "chip active" : "chip"}
            disabled={working || node.status === s}
            onClick={() => onStatus(node.id, s)}
          >
            {s}
          </button>
        ))}
        <button
          type="button"
          className="chip"
          disabled={working}
          onClick={() => onAddChild(node.id)}
        >
          + child
        </button>
      </div>
      {!isCollapsed &&
        kids.map((child) => (
          <PlanNodeView
            key={child.id}
            node={child}
            depth={depth + 1}
            working={working}
            collapsed={collapsed}
            onToggle={onToggle}
            onStatus={onStatus}
            onAddChild={onAddChild}
          />
        ))}
    </div>
  );
}

export function SwarmPanel({ busy, cwd, onLaunched }: Props) {
  const [name, setName] = useState("Mission");
  const [mission, setMission] = useState("");
  const [swarms, setSwarms] = useState<SwarmMission[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [working, setWorking] = useState(false);
  const [claimPath, setClaimPath] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mailBody, setMailBody] = useState("");
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const refresh = async () => {
    const res = await api<{ swarms: SwarmMission[] }>("/api/swarm");
    setSwarms(res.swarms);
  };

  useEffect(() => {
    void refresh().catch((err) => setError(err instanceof Error ? err.message : String(err)));
    const id = window.setInterval(() => {
      void refresh().catch(() => undefined);
    }, 3000);
    return () => window.clearInterval(id);
  }, []);

  const launch = async () => {
    setWorking(true);
    setError(null);
    try {
      const res = await api<{ swarm: SwarmMission }>("/api/swarm", {
        method: "POST",
        body: JSON.stringify({
          name: name.trim() || "Mission",
          mission: mission.trim(),
          cwd: cwd?.trim() || undefined,
        }),
      });
      await refresh();
      setSelectedId(res.swarm.id);
      onLaunched?.(res.swarm);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setWorking(false);
    }
  };

  const claim = async () => {
    if (!selectedId || !claimPath.trim()) return;
    const swarm = swarms.find((s) => s.id === selectedId);
    const builder = swarm?.members.find((m) => m.role === "builder");
    if (!builder?.sessionId) {
      setError("builder session missing");
      return;
    }
    setWorking(true);
    setError(null);
    try {
      await api(`/api/swarm/${selectedId}/claim`, {
        method: "POST",
        body: JSON.stringify({
          path: claimPath.trim(),
          role: "builder",
          sessionId: builder.sessionId,
        }),
      });
      setClaimPath("");
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setWorking(false);
    }
  };

  const setStatus = async (status: "running" | "done" | "failed") => {
    if (!selectedId) return;
    setWorking(true);
    setError(null);
    try {
      await api(`/api/swarm/${selectedId}/status`, {
        method: "POST",
        body: JSON.stringify({ status }),
      });
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setWorking(false);
    }
  };

  const postMail = async () => {
    if (!selectedId || !mailBody.trim()) return;
    setWorking(true);
    setError(null);
    try {
      await api(`/api/swarm/${selectedId}/mail`, {
        method: "POST",
        body: JSON.stringify({ fromRole: "human", body: mailBody.trim() }),
      });
      setMailBody("");
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setWorking(false);
    }
  };

  const setPlanStatus = async (nodeId: string, status: SwarmPlanStatus) => {
    if (!selectedId) return;
    setWorking(true);
    setError(null);
    try {
      await api(`/api/swarm/${selectedId}/plan`, {
        method: "POST",
        body: JSON.stringify({ nodeId, status }),
      });
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setWorking(false);
    }
  };

  const addNode = async (parentId?: string) => {
    if (!selectedId) return;
    const title = window.prompt(parentId ? "Child task title" : "Root task title");
    if (!title?.trim()) return;
    const roleRaw = window.prompt(
      "Optional role (coordinator/builder/scout/reviewer) — leave blank for none",
      "",
    );
    const role = ROLES.includes((roleRaw ?? "").trim() as SwarmRole | "")
      ? ((roleRaw ?? "").trim() as SwarmRole | "")
      : "";
    setWorking(true);
    try {
      await api(`/api/swarm/${selectedId}/plan/add`, {
        method: "POST",
        body: JSON.stringify({
          parentId,
          title: title.trim(),
          role: role || undefined,
        }),
      });
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setWorking(false);
    }
  };

  const selected = swarms.find((s) => s.id === selectedId) ?? swarms[0] ?? null;

  return (
    <div className="swarm-panel">
      <div className="swarm-form">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Swarm name" />
        <textarea
          value={mission}
          onChange={(e) => setMission(e.target.value)}
          placeholder="Mission brief — what should the team ship?"
          rows={4}
        />
        <button
          type="button"
          className="primary"
          disabled={busy || working || !mission.trim()}
          onClick={() => void launch()}
        >
          Launch swarm (4 roles)
        </button>
      </div>
      {error && <pre className="error">{error}</pre>}

      <div className="swarm-columns">
        <aside className="swarm-list">
          <div className="section-label">Missions</div>
          {swarms.length === 0 && <div className="empty">No swarms yet</div>}
          {swarms.map((s) => (
            <button
              key={s.id}
              type="button"
              className={selected?.id === s.id ? "session active" : "session"}
              onClick={() => setSelectedId(s.id)}
            >
              <span className="session-title">{s.name}</span>
              <span className="session-meta">{s.status}</span>
            </button>
          ))}
        </aside>

        <section className="swarm-detail">
          {selected ? (
            <>
              <h2>{selected.name}</h2>
              <p className="swarm-mission">{selected.mission}</p>
              <div className="swarm-members">
                {selected.members.map((m) => (
                  <div key={m.role} className="swarm-member">
                    <strong>{m.role}</strong>
                    <span>{m.agentId}</span>
                    <span className="session-meta">{m.sessionId?.slice(0, 8) ?? "—"}</span>
                  </div>
                ))}
              </div>
              <div className="section-label">File ownership</div>
              {selected.ownership.length === 0 && (
                <div className="empty">No claims yet</div>
              )}
              {selected.ownership.map((o) => (
                <div key={o.path} className="ownership-row">
                  <code>{o.path}</code>
                  <span>
                    {o.role} · {o.sessionId.slice(0, 8)}
                  </span>
                </div>
              ))}
              <div className="swarm-claim">
                <input
                  value={claimPath}
                  onChange={(e) => setClaimPath(e.target.value)}
                  placeholder="src/foo.ts"
                />
                <button type="button" className="secondary" disabled={working} onClick={() => void claim()}>
                  Claim for builder
                </button>
              </div>
              <div className="section-label">Status</div>
              <div className="swarm-status-row">
                <button type="button" className="secondary" disabled={working} onClick={() => void setStatus("running")}>
                  Running
                </button>
                <button type="button" className="secondary" disabled={working} onClick={() => void setStatus("done")}>
                  Mark done
                </button>
                <button type="button" className="secondary" disabled={working} onClick={() => void setStatus("failed")}>
                  Mark failed
                </button>
                <span className="session-meta">now: {selected.status}</span>
              </div>
              <div className="section-label">Mission plan</div>
              <div className="mission-toolbar">
                <button
                  type="button"
                  className="chip"
                  disabled={working}
                  onClick={() => void addNode()}
                >
                  + root task
                </button>
              </div>
              <div className="mission-tree">
                {(selected.plan ?? []).length === 0 && <div className="empty">No plan nodes</div>}
                {(selected.plan ?? []).map((node) => (
                  <PlanNodeView
                    key={node.id}
                    node={node}
                    depth={0}
                    working={working}
                    collapsed={collapsed}
                    onToggle={(id) =>
                      setCollapsed((prev) => ({ ...prev, [id]: !prev[id] }))
                    }
                    onStatus={(id, status) => void setPlanStatus(id, status)}
                    onAddChild={(id) => void addNode(id)}
                  />
                ))}
              </div>
              <div className="section-label">Shared mailbox</div>
              <div className="swarm-mailbox">
                {(selected.mailbox ?? []).map((m) => (
                  <div key={m.id} className="swarm-mail-item">
                    <strong>{m.fromRole}</strong>
                    <div>{m.body}</div>
                  </div>
                ))}
                <textarea
                  value={mailBody}
                  onChange={(e) => setMailBody(e.target.value)}
                  placeholder="Post a note the whole swarm can see…"
                  rows={3}
                />
                <button type="button" className="secondary" disabled={working || !mailBody.trim()} onClick={() => void postMail()}>
                  Post to mailbox
                </button>
              </div>
            </>
          ) : (
            <div className="empty-pane">Launch a swarm to coordinate roles</div>
          )}
        </section>
      </div>
    </div>
  );
}
