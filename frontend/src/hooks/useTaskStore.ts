import { useState, useCallback, useEffect, useRef } from "react";
import type { Task, DayEntry, WSMessage } from "../types.js";
import { fetchDays, fetchTasks, addCompletion, removeCompletion } from "../api.js";
import { useWS } from "./useWS.js";

function localDateStr(date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function getDateRange(halfSpan = 14): { from: string; to: string } {
  const today = new Date();
  const from = new Date(today);
  from.setDate(today.getDate() - halfSpan);
  const to = new Date(today);
  to.setDate(today.getDate() + halfSpan);
  return {
    from: localDateStr(from),
    to: localDateStr(to),
  };
}

export function todayStr(): string {
  return localDateStr();
}

// If it's within the first hour of the day, treat yesterday as still editable.
export function editableTodayStr(): string {
  const now = new Date();
  if (now.getHours() < 1) {
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    return localDateStr(yesterday);
  }
  return localDateStr(now);
}

export interface TaskStoreState {
  days: DayEntry[];
  tasks: Task[];
  loading: boolean;
  error: string | null;
  toggleCompletion: (taskId: string, date: string, periodKey: string, currentlyComplete: boolean, completedAt?: string) => Promise<void>;
  setCount: (taskId: string, date: string, periodKey: string, newCount: number, completedAt?: string) => Promise<void>;
  reload: () => Promise<void>;
}

export function useTaskStore(): TaskStoreState {
  const [days, setDays] = useState<DayEntry[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const rangeRef = useRef(getDateRange(14));

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { from, to } = rangeRef.current;
      const [dayData, taskData] = await Promise.all([fetchDays(from, to, editableTodayStr()), fetchTasks()]);
      setDays(dayData);
      setTasks(taskData);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load data");
    } finally {
      setLoading(false);
    }
  }, []);

  const handleWSMessage = useCallback(
    (msg: WSMessage) => {
      if (msg.type === "sync" || msg.type === "patch") reload();
    },
    [reload]
  );

  useWS(handleWSMessage);

  useEffect(() => {
    reload();
  }, [reload]);

  const toggleCompletion = useCallback(
    async (taskId: string, date: string, periodKey: string, currentlyComplete: boolean, completedAt?: string) => {
      try {
        if (currentlyComplete) {
          await removeCompletion(taskId, periodKey);
        } else {
          await addCompletion(taskId, date, undefined, completedAt);
        }
        await reload();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to update completion");
        await reload();
      }
    },
    [reload]
  );

  // Set an explicit count for a multi-count task. newCount=0 removes the completion.
  const setCount = useCallback(
    async (taskId: string, date: string, periodKey: string, newCount: number, completedAt?: string) => {
      try {
        if (newCount <= 0) {
          await removeCompletion(taskId, periodKey);
        } else {
          await addCompletion(taskId, date, newCount, completedAt);
        }
        await reload();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to update count");
        await reload();
      }
    },
    [reload]
  );

  return { days, tasks, loading, error, toggleCompletion, setCount, reload };
}
