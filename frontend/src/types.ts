export type FreqType = "daily" | "days_of_week" | "weekly" | "monthly";
export type CompletionState = "none" | "this_day" | "earlier_in_period" | "later_in_period";

export interface Task {
  id: string;
  user: string;
  name: string;
  description: string | null;
  freq_type: FreqType;
  freq_config: string | null; // JSON string
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

export interface WSMessage {
  type: "sync" | "patch";
  payload: {
    tasks: Task[];
    completions: Completion[];
    deleted_completions?: Array<{ task_id: string; period_key: string }>;
  };
}

export interface TaskStats {
  task: Task;
  total_completions: number;
  last_completed_at: string | null;
  first_completion_at: string | null;
  possible_days: number;
  completion_rate: number;
  completions_by_hour: number[]; // length 24, UTC hours
  completion_dates: string[];    // YYYY-MM-DD, sorted
}

export interface FreqConfig {
  days?: number[]; // 0=Sun..6=Sat for days_of_week
}
