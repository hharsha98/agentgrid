import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { DEFAULT_SERVER_PORT, DEFAULT_WEB_PORT } from "../../packages/shared/src/protocol.ts";

export default defineConfig({
  plugins: [react()],
  // Relative asset URLs so the Tauri packaged app can load the built UI.
  base: "./",
  clearScreen: false,
  server: {
    port: DEFAULT_WEB_PORT,
    strictPort: true,
    proxy: {
      "/api": {
        target: `http://127.0.0.1:${DEFAULT_SERVER_PORT}`,
        changeOrigin: true,
        ws: true,
      },
    },
  },
});
