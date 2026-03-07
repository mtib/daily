import { Hono } from "hono";
import {
  db,
  getPeriodKey,
  taskAppliesOnDate,
  type Task,
  type Completion,
  type CompletionEvent,
} from "../db.js";
import { broadcastToUser } from "../ws.js";

const app = new Hono();

// POST /api/completions — mark a task as complete for a date
app.post("/", async (c) => {
  const user = c.get("user") as string;
  const body = await c.req.json();
  const { task_id, date, count, completed_at } = body;

  if (!task_id || !date) {
    return c.json({ error: "task_id and date are required" }, 400);
  }

  const task = db
    .query<Task, [string, string]>(`SELECT * FROM tasks WHERE id = ? AND user = ?`)
    .get(task_id, user);

  if (!task) {
    return c.json({ error: "Task not found" }, 404);
  }

  if (!taskAppliesOnDate(task, date)) {
    return c.json({ error: "Task does not apply on this date" }, 400);
  }

  const periodKey = getPeriodKey(task.freq_type, date);
  const now = new Date().toISOString();
  const eventTimestamp: string =
    typeof completed_at === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(completed_at)
      ? completed_at
      : now;
  const newCount: number = count ?? 1;

  // Get existing completion to determine count delta
  const existing = db
    .query<Completion, [string, string]>(`SELECT * FROM completions WHERE task_id = ? AND period_key = ?`)
    .get(task_id, periodKey);
  const oldCount = existing?.count ?? 0;

  // Upsert the completion record
  const id = crypto.randomUUID();
  db.run(
    `INSERT INTO completions (id, task_id, user, period_key, actual_date, count, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(task_id, period_key) DO UPDATE SET count = excluded.count, actual_date = excluded.actual_date`,
    [id, task_id, user, periodKey, date, newCount, now]
  );

  // Sync completion_events to reflect the delta
  const delta = newCount - oldCount;
  if (delta > 0) {
    // Insert one event per increment
    for (let i = 0; i < delta; i++) {
      db.run(
        `INSERT INTO completion_events (id, task_id, user, period_key, created_at) VALUES (?, ?, ?, ?, ?)`,
        [crypto.randomUUID(), task_id, user, periodKey, eventTimestamp]
      );
    }
  } else if (delta < 0) {
    // Delete most-recent events for the decrement
    const toDelete = db
      .query<CompletionEvent, [string, string, number]>(
        `SELECT * FROM completion_events WHERE task_id = ? AND period_key = ? ORDER BY created_at DESC LIMIT ?`
      )
      .all(task_id, periodKey, -delta);
    for (const ev of toDelete) {
      db.run(`DELETE FROM completion_events WHERE id = ?`, [ev.id]);
    }
  }

  const completion = db
    .query<Completion, [string, string]>(`SELECT * FROM completions WHERE task_id = ? AND period_key = ?`)
    .get(task_id, periodKey)!;

  broadcastToUser(user, { type: "patch", payload: { tasks: [], completions: [completion] } });
  return c.json(completion, 201);
});

// DELETE /api/completions/:task_id/:period — remove a completion
app.delete("/:task_id/:period", (c) => {
  const user = c.get("user") as string;
  const task_id = c.req.param("task_id");
  const period = c.req.param("period");

  const completion = db
    .query<Completion, [string, string, string]>(
      `SELECT c.* FROM completions c
       JOIN tasks t ON t.id = c.task_id
       WHERE c.task_id = ? AND c.period_key = ? AND t.user = ?`
    )
    .get(task_id, period, user);

  if (!completion) {
    return c.json({ error: "Completion not found" }, 404);
  }

  db.run(`DELETE FROM completions WHERE task_id = ? AND period_key = ?`, [task_id, period]);
  db.run(`DELETE FROM completion_events WHERE task_id = ? AND period_key = ?`, [task_id, period]);

  broadcastToUser(user, {
    type: "patch",
    payload: {
      tasks: [],
      completions: [],
      deleted_completions: [{ task_id, period_key: period }],
    },
  });
  return c.json({ success: true });
});

export default app;
