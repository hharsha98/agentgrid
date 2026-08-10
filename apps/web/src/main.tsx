import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { applyTheme, loadTheme } from "./lib/themes";
import "./styles.css";
import "./app.css";

// Apply saved theme before first paint so chrome + terminals match.
applyTheme(loadTheme());

const root = document.getElementById("root");
if (!root) throw new Error("#root missing");

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
