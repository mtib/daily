import { Hono } from "hono";
import { db, type Task, type Completion } from "../db.js";

const app = new Hono();

interface TaskStats {
  task: Task;
  total_completions: number;
  last_completed_at: string | null;  // ISO date string
  first_completion_at: string | null;
  possible_days: number;             // applicable days from creation until today
  completion_rate: number;           // 0–1
  // Histogram: hour-of-day (0–23) -> count, in UTC (client converts to local)
  completions_by_hour: number[];
  // Daily completion dates (actual_date) for timeline display
  completion_dates: string[];
}

// GET /api/stats — task completion stats for the authenticated user
app.get("/", (c) => {
  const user = c.get("user") as string;
  const today = new Date().toISOString().substring(0, 10);

  // All tasks (including soft-deleted ones that have completions)
  const tasks = db
    .query<Task, [string]>(
      `SELECT * FROM tasks WHERE user = ? ORDER BY created_at ASC`
    )
    .all(user);

  // All completions for this user
  const allCompletions = db
    .query<Completion & { created_at: string }, [string]>(
      `SELECT c.* FROM completions c
       JOIN tasks t ON t.id = c.task_id
       WHERE t.user = ?
       ORDER BY c.actual_date DESC, c.created_at DESC`
    )
    .all(user);

  // Group completions by task_id
  const byTask = new Map<string, Array<Completion & { created_at: string }>>();
  for (const c of allCompletions) {
    if (!byTask.has(c.task_id)) byTask.set(c.task_id, []);
    byTask.get(c.task_id)!.push(c);
  }

  const stats: TaskStats[] = tasks.map((task) => {
    const completions = byTask.get(task.id) ?? [];

    const sortedDates = completions
      .map((c) => c.actual_date)
      .sort();

    // Possible applicable days from creation date to today (or deletion date)
    const endDate = task.deleted_at && task.deleted_at <= today ? task.deleted_at : today;
    let possible_days = 0;
    const start = new Date(task.created_at.substring(0, 10) + "T00:00:00Z");
    const end = new Date(endDate + "T00:00:00Z");

    if (task.freq_type === "daily" || task.freq_type === "days_of_week") {
      for (let d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
        const ds = d.toISOString().substring(0, 10);
        if (task.freq_type === "daily") {
          possible_days++;
        } else {
          const cfg = task.freq_config ? JSON.parse(task.freq_config) : { days: [] };
          if (cfg.days.includes(d.getUTCDay())) possible_days++;
        }
      }
    } else if (task.freq_type === "weekly") {
      // Count ISO weeks between creation and today
      const msPerWeek = 7 * 24 * 60 * 60 * 1000;
      possible_days = Math.floor((end.getTime() - start.getTime()) / msPerWeek) + 1;
    } else if (task.freq_type === "monthly") {
      // Count months
      possible_days =
        (end.getUTCFullYear() - start.getUTCFullYear()) * 12 +
        (end.getUTCMonth() - start.getUTCMonth()) +
        1;
    }

    // Completions by hour of day (from created_at timestamp)
    const completions_by_hour = Array(24).fill(0) as number[];
    for (const c of completions) {
      const hour = new Date(c.created_at).getUTCHours();
      completions_by_hour[hour]++;
    }

    return {
      task,
      total_completions: completions.length,
      last_completed_at: sortedDates.length > 0 ? sortedDates[sortedDates.length - 1] : null,
      first_completion_at: sortedDates.length > 0 ? sortedDates[0] : null,
      possible_days,
      completion_rate: possible_days > 0 ? Math.min(completions.length / possible_days, 1) : 0,
      completions_by_hour,
      completion_dates: sortedDates,
    };
  });

  // Sort: tasks with completions first (most recently completed at top), then never-completed
  stats.sort((a, b) => {
    if (a.last_completed_at && b.last_completed_at) {
      return b.last_completed_at.localeCompare(a.last_completed_at);
    }
    if (a.last_completed_at) return -1;
    if (b.last_completed_at) return 1;
    return a.task.name.localeCompare(b.task.name);
  });

  return c.json(stats);
});

export default app;
