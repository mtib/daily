import { Hono } from "hono";
import {
  db,
  getPeriodKey,
  taskAppliesOnDate,
  getApplicableDaysBefore,
  type Task,
  type Completion,
} from "../db.js";

const app = new Hono();

export type CompletionState = "none" | "this_day" | "earlier_in_period" | "later_in_period";

export interface DayTaskEntry {
  task: Task;
  completion: Completion | null;
  period_key: string;
  missed_streak: number;
  completion_state: CompletionState;
}

export interface DayEntry {
  date: string;
  tasks: DayTaskEntry[];
}

// GET /api/days?from=YYYY-MM-DD&to=YYYY-MM-DD
app.get("/", (c) => {
  const user = c.get("user") as string;
  const from = c.req.query("from");
  const to = c.req.query("to");
  const todayParam = c.req.query("today");

  if (!from || !to) {
    return c.json({ error: "from and to query params are required" }, 400);
  }

  const today = todayParam ?? new Date().toISOString().substring(0, 10);

  // Get tasks visible in this range (created before end, not deleted before start)
  const tasks = db
    .query<Task, [string, string, string]>(
      `SELECT * FROM tasks
       WHERE user = ?
         AND created_at <= ?
         AND (deleted_at IS NULL OR deleted_at > ?)
       ORDER BY created_at ASC`
    )
    .all(user, to + "T23:59:59Z", from);

  // Get all completions for these tasks (load all periods; small dataset per user)
  const taskIds = tasks.map((t) => t.id);
  let allCompletions: Completion[] = [];
  if (taskIds.length > 0) {
    const placeholders = taskIds.map(() => "?").join(",");
    allCompletions = db
      .query<Completion, string[]>(
        `SELECT * FROM completions WHERE task_id IN (${placeholders})`
      )
      .all(...taskIds);
  }

  // Build lookup: "task_id:period_key" -> completion
  const completionMap = new Map<string, Completion>();
  for (const comp of allCompletions) {
    completionMap.set(`${comp.task_id}:${comp.period_key}`, comp);
  }

  const days: DayEntry[] = [];
  const startDate = new Date(from + "T00:00:00Z");
  const endDate = new Date(to + "T00:00:00Z");

  for (let d = new Date(startDate); d <= endDate; d.setUTCDate(d.getUTCDate() + 1)) {
    const dateStr = d.toISOString().substring(0, 10);
    const dayTasks: DayTaskEntry[] = [];

    for (const task of tasks) {
      if (!taskAppliesOnDate(task, dateStr)) continue;

      const periodKey = getPeriodKey(task.freq_type, dateStr);
      const completion = completionMap.get(`${task.id}:${periodKey}`) ?? null;

      let completion_state: CompletionState = "none";
      if (completion) {
        if (completion.actual_date === dateStr) {
          completion_state = "this_day";
        } else if (completion.actual_date < dateStr) {
          completion_state = "earlier_in_period";
        } else {
          completion_state = "later_in_period";
        }
      }

      // Missed streak: consecutive prior applicable days with no completion
      let missed_streak = 0;
      if (!completion) {
        // Only count streak for past days (not future)
        if (dateStr <= today) {
          const prevDays = getApplicableDaysBefore(task, dateStr, 30);
          for (const prevDay of prevDays) {
            const prevPeriodKey = getPeriodKey(task.freq_type, prevDay);
            if (completionMap.has(`${task.id}:${prevPeriodKey}`)) break;
            missed_streak++;
          }
        }
      }

      dayTasks.push({ task, completion, period_key: periodKey, missed_streak, completion_state });
    }

    // A multi-count task is only "done" for sorting once count >= target_count.
    function isDone(entry: DayTaskEntry): boolean {
      if (entry.task.target_count > 1) {
        return (entry.completion?.count ?? 0) >= entry.task.target_count;
      }
      return entry.completion_state !== "none";
    }

    // Sort: incomplete with streak first, then incomplete, then complete
    dayTasks.sort((a, b) => {
      const aComplete = isDone(a);
      const bComplete = isDone(b);
      if (aComplete !== bComplete) return aComplete ? 1 : -1;
      if (a.missed_streak !== b.missed_streak) return b.missed_streak - a.missed_streak;
      return a.task.name.localeCompare(b.task.name);
    });

    days.push({ date: dateStr, tasks: dayTasks });
  }

  return c.json(days);
});

export default app;
