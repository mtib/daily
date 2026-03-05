// Minimal static file server for the built frontend
import { join } from "path";

const distDir = join(import.meta.dir, "dist");

const server = Bun.serve({
  port: 3000,
  async fetch(req) {
    const url = new URL(req.url);
    let pathname = url.pathname;

    // Default to index.html for SPA routing
    if (pathname === "/" || !pathname.includes(".")) {
      pathname = "/index.html";
    }

    const filePath = join(distDir, pathname);

    try {
      const file = Bun.file(filePath);
      const exists = await file.exists();
      if (!exists) {
        // Fall back to index.html for client-side routing
        const index = Bun.file(join(distDir, "index.html"));
        return new Response(index, {
          headers: { "Content-Type": "text/html" },
        });
      }
      return new Response(file);
    } catch {
      return new Response("Not Found", { status: 404 });
    }
  },
});

console.log(`Frontend serving on http://localhost:${server.port}`);
