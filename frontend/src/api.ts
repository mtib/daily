import type { Task, Completion, DayEntry, TaskStats } from "./types.js";

const BASE = "/api";

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error ?? `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

// Tasks
export async function fetchTasks(): Promise<Task[]> {
  return handleResponse(await fetch(`${BASE}/tasks`));
}

export async function createTask(data: {
  name: string;
  description?: string;
  freq_type: string;
  freq_config?: unknown;
  target_count?: number;
}): Promise<Task> {
  return handleResponse(
    await fetch(`${BASE}/tasks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    })
  );
}

export async function updateTask(
  id: string,
  data: Partial<{
    name: string;
    description: string;
    freq_type: string;
    freq_config: unknown;
    target_count: number;
  }>
): Promise<Task> {
  return handleResponse(
    await fetch(`${BASE}/tasks/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    })
  );
}

export async function deleteTask(id: string): Promise<void> {
  await handleResponse(await fetch(`${BASE}/tasks/${id}`, { method: "DELETE" }));
}

// Days
export async function fetchDays(from: string, to: string): Promise<DayEntry[]> {
  return handleResponse(await fetch(`${BASE}/days?from=${from}&to=${to}`));
}

// Stats
export async function fetchStats(): Promise<TaskStats[]> {
  return handleResponse(await fetch(`${BASE}/stats`));
}

// Completions
export async function addCompletion(task_id: string, date: string, count?: number): Promise<Completion> {
  return handleResponse(
    await fetch(`${BASE}/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ task_id, date, count }),
    })
  );
}

export async function removeCompletion(task_id: string, period_key: string): Promise<void> {
  await handleResponse(
    await fetch(`${BASE}/completions/${task_id}/${period_key}`, { method: "DELETE" })
  );
}
