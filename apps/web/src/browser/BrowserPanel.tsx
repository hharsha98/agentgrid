import { useEffect, useState } from "react";

const STORAGE_KEY = "agentgrid.browser.url";

export function BrowserPanel() {
  const [url, setUrl] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) || "http://127.0.0.1:3000";
    } catch {
      return "http://127.0.0.1:3000";
    }
  });
  const [loaded, setLoaded] = useState(url);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, loaded);
    } catch {
      // ignore
    }
  }, [loaded]);

  return (
    <div className="browser-panel">
      <form
        className="browser-bar"
        onSubmit={(e) => {
          e.preventDefault();
          let next = url.trim();
          if (next && !/^https?:\/\//i.test(next)) next = `http://${next}`;
          setLoaded(next);
        }}
      >
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="http://127.0.0.1:3000"
          aria-label="Browser URL"
        />
        <button type="submit" className="secondary">
          Go
        </button>
        <button
          type="button"
          className="chip"
          onClick={() => setLoaded((u) => u + (u.includes("?") ? "&" : "?") + "_r=" + Date.now())}
        >
          Reload
        </button>
      </form>
      <iframe
        className="browser-frame"
        title="Embedded localhost browser"
        src={loaded}
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals"
      />
      <p className="browser-hint">
        Review localhost apps beside your agent grid. Some sites block iframes.
      </p>
    </div>
  );
}
