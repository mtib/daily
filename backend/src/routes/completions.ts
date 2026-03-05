import { Hono } from "hono";
import {
  db,
  getPeriodKey,
  taskAppliesOnDate,
  getApplicableDaysBefore,
  type Task,
  type Completion,
} from "../db.js";
import { broadcastToUser } from "../ws.js";

const app = new Hono();

// POST /api/completions — mark a task as complete for a date
app.post("/", async (c) => {
  const user = c.get("user") as string;
  const body = await c.req.json();
  const { task_id, date, count } = body;

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
  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  db.run(
    `INSERT INTO completions (id, task_id, user, period_key, actual_date, count, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(task_id, period_key) DO UPDATE SET count = excluded.count, actual_date = excluded.actual_date`,
    [id, task_id, user, periodKey, date, count ?? 1, now]
  );

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
