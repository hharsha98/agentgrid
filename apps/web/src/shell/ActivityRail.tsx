import { APP_VIEWS, type AppView } from "./types";

interface Props {
  view: AppView;
  onView: (view: AppView) => void;
}

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
          <span className="rail-short">{v.short}</span>
          <span className="rail-label">{v.label}</span>
        </button>
      ))}
    </nav>
  );
}
