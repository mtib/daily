import { Hono } from "hono";
import { cors } from "hono/cors";
import { authMiddleware } from "./auth.js";
import tasksRouter from "./routes/tasks.js";
import completionsRouter from "./routes/completions.js";
import daysRouter from "./routes/days.js";
import statsRouter from "./routes/stats.js";
import {
  registerConnection,
  removeConnection,
  getFullState,
  broadcastToUser,
  type WSData,
} from "./ws.js";

const app = new Hono();

// CORS for local development
app.use("*", cors());

// Auth middleware for all /api routes
app.use("/api/*", authMiddleware);

// Mount routers
app.route("/api/tasks", tasksRouter);
app.route("/api/completions", completionsRouter);
app.route("/api/days", daysRouter);
app.route("/api/stats", statsRouter);

// Health check
app.get("/health", (c) => c.json({ ok: true }));

const PORT = parseInt(process.env.PORT ?? "3001");

// Start server with WebSocket support
const server = Bun.serve<WSData>({
  port: PORT,
  fetch(req, server) {
    // Handle WebSocket upgrade
    if (req.url.endsWith("/api/ws")) {
      const user =
        req.headers.get("Tailscale-User") ??
        req.headers.get("X-Webauth-User") ??
        (process.env.NODE_ENV !== "production" ? "dev-user" : null);

      if (!user) {
        return new Response("Unauthorized", { status: 401 });
      }

      const upgraded = server.upgrade(req, { data: { user } });
      if (upgraded) return undefined;
      return new Response("WebSocket upgrade failed", { status: 400 });
    }

    // Delegate to Hono
    return app.fetch(req);
  },
  websocket: {
    open(ws) {
      const user = ws.data.user;
      registerConnection(user, ws);

      // Send full state on connect
      const state = getFullState(user);
      ws.send(JSON.stringify({ type: "sync", payload: state }));
    },
    message(ws, message) {
      // Clients don't send messages over WS (mutations go through REST)
      // but handle ping/pong for keepalive
      if (message === "ping") {
        ws.send("pong");
      }
    },
    close(ws) {
      removeConnection(ws.data.user, ws);
    },
  },
});

console.log(`Backend running on http://localhost:${PORT}`);
