import { APP_VIEWS, type AppView } from "./types";

interface Props {
  view: AppView;
  onView: (view: AppView) => void;
}

/** Simple geometric marks — not BridgeMind icons. */
const RAIL_MARK: Record<AppView, string> = {
  grid: "▦",
  board: "▥",
  swarm: "◈",
  files: "▤",
  memory: "◉",
  skills: "✦",
  prompts: "✎",
  browser: "◎",
};

export function ActivityRail({ view, onView }: Props) {
  return (
    <nav className="activity-rail" aria-label="Main views">
      {APP_VIEWS.map((v) => (
        <button
          key={v.id}
          type="button"
          className={view === v.id ? "rail-btn active" : "rail-btn"}
          onClick={() => onView(v.id)}
          title={v.label}
          aria-current={view === v.id ? "page" : undefined}
        >
          <span className="rail-mark" aria-hidden>
            {RAIL_MARK[v.id]}
          </span>
          <span className="rail-label">{v.label}</span>
        </button>
      ))}
    </nav>
  );
}
