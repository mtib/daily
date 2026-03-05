import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { readFileSync, writeFileSync } from "fs";
import { resolve } from "path";

// Plugin: stamp sw.js with the build timestamp so each deploy gets a
// unique cache name, causing activate() to evict the previous cache.
function injectSwVersion(): import("vite").Plugin {
  return {
    name: "inject-sw-version",
    apply: "build",
    closeBundle() {
      const swPath = resolve(__dirname, "dist/sw.js");
      const content = readFileSync(swPath, "utf-8");
      const version = Date.now().toString();
      writeFileSync(swPath, content.replace("__CACHE_VERSION__", version));
    },
  };
}

export default defineConfig({
  plugins: [react(), injectSwVersion()],
  server: {
    port: 5173,
    proxy: {
      "/api": "http://localhost:3001",
      "/ws": {
        target: "ws://localhost:3001",
        ws: true,
      },
    },
  },
  build: {
    outDir: "dist",
  },
});
