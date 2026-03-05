import { Hono } from "hono";
import { db, type Task } from "../db.js";
import { broadcastToUser } from "../ws.js";

const app = new Hono();

// GET /api/tasks — list active tasks for the current user
app.get("/", (c) => {
  const user = c.get("user") as string;
  const tasks = db
    .query<Task, [string]>(
      `SELECT * FROM tasks WHERE user = ? AND deleted_at IS NULL ORDER BY created_at ASC`
    )
    .all(user);
  return c.json(tasks);
});

// POST /api/tasks — create a new task
app.post("/", async (c) => {
  const user = c.get("user") as string;
  const body = await c.req.json();
  const { name, description, freq_type, freq_config, target_count } = body;

  if (!name || !freq_type) {
    return c.json({ error: "name and freq_type are required" }, 400);
  }

  const validFreqTypes = ["daily", "days_of_week", "weekly", "monthly"];
  if (!validFreqTypes.includes(freq_type)) {
    return c.json({ error: "invalid freq_type" }, 400);
  }

  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const configStr = freq_config ? JSON.stringify(freq_config) : null;

  db.run(
    `INSERT INTO tasks (id, user, name, description, freq_type, freq_config, target_count, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, user, name, description ?? null, freq_type, configStr, target_count ?? 1, now, now]
  );

  const task = db.query<Task, [string]>(`SELECT * FROM tasks WHERE id = ?`).get(id)!;
  broadcastToUser(user, { type: "patch", payload: { tasks: [task], completions: [] } });
  return c.json(task, 201);
});

// PUT /api/tasks/:id — update task
app.put("/:id", async (c) => {
  const user = c.get("user") as string;
  const id = c.req.param("id");
  const body = await c.req.json();
  const { name, description, freq_type, freq_config, target_count } = body;

  const existing = db
    .query<Task, [string, string]>(`SELECT * FROM tasks WHERE id = ? AND user = ? AND deleted_at IS NULL`)
    .get(id, user);

  if (!existing) {
    return c.json({ error: "Task not found" }, 404);
  }

  const now = new Date().toISOString();
  const configStr = freq_config !== undefined ? JSON.stringify(freq_config) : existing.freq_config;

  db.run(
    `UPDATE tasks SET name = ?, description = ?, freq_type = ?, freq_config = ?, target_count = ?, updated_at = ?
     WHERE id = ? AND user = ?`,
    [
      name ?? existing.name,
      description !== undefined ? description : existing.description,
      freq_type ?? existing.freq_type,
      configStr,
      target_count ?? existing.target_count,
      now,
      id,
      user,
    ]
  );

  const task = db.query<Task, [string]>(`SELECT * FROM tasks WHERE id = ?`).get(id)!;
  broadcastToUser(user, { type: "patch", payload: { tasks: [task], completions: [] } });
  return c.json(task);
});

// DELETE /api/tasks/:id — soft-delete task
app.delete("/:id", (c) => {
  const user = c.get("user") as string;
  const id = c.req.param("id");

  const existing = db
    .query<Task, [string, string]>(`SELECT * FROM tasks WHERE id = ? AND user = ? AND deleted_at IS NULL`)
    .get(id, user);

  if (!existing) {
    return c.json({ error: "Task not found" }, 404);
  }

  const now = new Date().toISOString();
  // Soft delete: set deleted_at to today so past data is preserved
  const today = now.substring(0, 10);
  db.run(`UPDATE tasks SET deleted_at = ?, updated_at = ? WHERE id = ? AND user = ?`, [today, now, id, user]);

  const task = db.query<Task, [string]>(`SELECT * FROM tasks WHERE id = ?`).get(id)!;
  broadcastToUser(user, { type: "patch", payload: { tasks: [task], completions: [] } });
  return c.json({ success: true });
});

export default app;
