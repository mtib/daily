import { Database } from "bun:sqlite";

const dbPath = process.env.DATABASE_PATH ?? "./data/tasks.db";

// Ensure directory exists
const dir = dbPath.substring(0, dbPath.lastIndexOf("/"));
if (dir) {
  await Bun.write(`${dir}/.keep`, "");
}

export const db = new Database(dbPath, { create: true });

// Enable WAL for better concurrent read performance
db.exec("PRAGMA journal_mode = WAL");
db.exec("PRAGMA foreign_keys = ON");

// Migrations
db.exec(`
  CREATE TABLE IF NOT EXISTS tasks (
    id          TEXT PRIMARY KEY,
    user        TEXT NOT NULL,
    name        TEXT NOT NULL,
    description TEXT,
    freq_type   TEXT NOT NULL,
    freq_config TEXT,
    target_count INTEGER DEFAULT 1,
    created_at  TEXT NOT NULL,
    updated_at  TEXT NOT NULL,
    deleted_at  TEXT
  );

  CREATE TABLE IF NOT EXISTS completions (
    id          TEXT PRIMARY KEY,
    task_id     TEXT NOT NULL REFERENCES tasks(id),
    user        TEXT NOT NULL,
    period_key  TEXT NOT NULL,
    actual_date TEXT NOT NULL,
    count       INTEGER DEFAULT 1,
    created_at  TEXT NOT NULL
  );

  CREATE UNIQUE INDEX IF NOT EXISTS uq_completion ON completions(task_id, period_key);
`);

export type FreqType = "daily" | "days_of_week" | "weekly" | "monthly";

export interface Task {
  id: string;
  user: string;
  name: string;
  description: string | null;
  freq_type: FreqType;
  freq_config: string | null;
  target_count: number;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface Completion {
  id: string;
  task_id: string;
  user: string;
  period_key: string;
  actual_date: string;
  count: number;
  created_at: string;
}

/**
 * Compute the period_key for a given task and date string (YYYY-MM-DD).
 */
export function getPeriodKey(freqType: FreqType, dateStr: string): string {
  if (freqType === "weekly") {
    return getISOWeekMonday(dateStr);
  }
  if (freqType === "monthly") {
    return dateStr.substring(0, 7); // YYYY-MM
  }
  return dateStr; // daily / days_of_week
}

/**
 * Returns the ISO week Monday (YYYY-MM-DD) for a given date string.
 */
export function getISOWeekMonday(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00Z");
  const day = d.getUTCDay(); // 0=Sun
  const diff = (day === 0 ? -6 : 1 - day); // shift to Monday
  d.setUTCDate(d.getUTCDate() + diff);
  return d.toISOString().substring(0, 10);
}

/**
 * Check whether a task applies to a specific date.
 */
export function taskAppliesOnDate(task: Task, dateStr: string): boolean {
  // Tasks only appear from their creation date onward
  if (dateStr < task.created_at.substring(0, 10)) return false;
  // Soft-deleted tasks: don't appear on dates on or after deletion
  if (task.deleted_at && dateStr >= task.deleted_at) return false;

  switch (task.freq_type) {
    case "daily":
      return true;
    case "days_of_week": {
      const config = task.freq_config ? JSON.parse(task.freq_config) : { days: [] };
      const d = new Date(dateStr + "T00:00:00Z");
      return config.days.includes(d.getUTCDay());
    }
    case "weekly":
      return true; // applies to all days of the week (shows on every day)
    case "monthly":
      return true; // applies to all days of the month
    default:
      return false;
  }
}

/**
 * Get all applicable dates going backward from (not including) startDate,
 * limited to maxDays, for streak calculation.
 */
export function getApplicableDaysBefore(task: Task, startDate: string, maxDays = 30): string[] {
  const result: string[] = [];
  const d = new Date(startDate + "T00:00:00Z");
  for (let i = 0; i < maxDays * 2 && result.length < maxDays; i++) {
    d.setUTCDate(d.getUTCDate() - 1);
    const ds = d.toISOString().substring(0, 10);
    if (task.deleted_at && ds >= task.deleted_at) continue;
    if (task.created_at.substring(0, 10) > ds) break;
    if (taskAppliesOnDate(task, ds)) {
      result.push(ds);
    }
  }
  return result;
}
