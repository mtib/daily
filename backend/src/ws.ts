import type { ServerWebSocket } from "bun";
import { db, type Task, type Completion } from "./db.js";

interface WSData {
  user: string;
}

// Per-user connection registry
const connections = new Map<string, Set<ServerWebSocket<WSData>>>();

export function registerConnection(user: string, ws: ServerWebSocket<WSData>) {
  if (!connections.has(user)) {
    connections.set(user, new Set());
  }
  connections.get(user)!.add(ws);
}

export function removeConnection(user: string, ws: ServerWebSocket<WSData>) {
  connections.get(user)?.delete(ws);
}

export function broadcastToUser(user: string, message: unknown) {
  const conns = connections.get(user);
  if (!conns || conns.size === 0) return;
  const json = JSON.stringify(message);
  for (const ws of conns) {
    try {
      ws.send(json);
    } catch {
      conns.delete(ws);
    }
  }
}

export function getFullState(user: string): { tasks: Task[]; completions: Completion[] } {
  const tasks = db
    .query<Task, [string]>(`SELECT * FROM tasks WHERE user = ? ORDER BY created_at ASC`)
    .all(user);

  const completions = db
    .query<Completion, [string]>(
      `SELECT c.* FROM completions c
       JOIN tasks t ON t.id = c.task_id
       WHERE t.user = ?
       ORDER BY c.created_at DESC`
    )
    .all(user);

  return { tasks, completions };
}

export type { WSData };
