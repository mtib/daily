import { useState, type FC, type FormEvent } from "react";
import { X, Plus, Trash2, ChevronRight } from "lucide-react";
import type { Task, FreqType, FreqConfig } from "../types.js";
import { createTask, updateTask, deleteTask } from "../api.js";
import { Tooltip } from "./Tooltip.js";

interface Props {
  tasks: Task[];
  onClose: () => void;
  onChanged: () => void;
}

const FREQ_LABELS: Record<FreqType, string> = {
  daily: "Daily",
  days_of_week: "Specific days",
  weekly: "Weekly",
  monthly: "Monthly",
};

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

interface FormState {
  name: string;
  description: string;
  freq_type: FreqType;
  days_of_week: number[];
  target_count: number;
}

const defaultForm: FormState = {
  name: "",
  description: "",
  freq_type: "daily",
  days_of_week: [1, 2, 3, 4, 5],
  target_count: 1,
};

function taskToForm(task: Task): FormState {
  let days_of_week = defaultForm.days_of_week;
  if (task.freq_type === "days_of_week" && task.freq_config) {
    try {
      const cfg: FreqConfig = JSON.parse(task.freq_config);
      days_of_week = cfg.days ?? days_of_week;
    } catch {}
  }
  return {
    name: task.name,
    description: task.description ?? "",
    freq_type: task.freq_type,
    days_of_week,
    target_count: task.target_count,
  };
}

export const TaskManager: FC<Props> = ({ tasks, onClose, onChanged }) => {
  const [editing, setEditing] = useState<Task | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<FormState>(defaultForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function startCreate() {
    setEditing(null);
    setForm(defaultForm);
    setCreating(true);
    setError(null);
  }

  function startEdit(task: Task) {
    setEditing(task);
    setForm(taskToForm(task));
    setCreating(false);
    setError(null);
  }

  function cancelForm() {
    setEditing(null);
    setCreating(false);
    setError(null);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const freq_config: FreqConfig | null =
        form.freq_type === "days_of_week" ? { days: form.days_of_week } : null;

      const data = {
        name: form.name.trim(),
        description: form.description.trim() || undefined,
        freq_type: form.freq_type,
        freq_config,
        target_count: form.target_count,
      };

      if (editing) {
        await updateTask(editing.id, data);
      } else {
        await createTask(data);
      }
      cancelForm();
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(task: Task) {
    if (!confirm(`Delete "${task.name}"? Past completions are preserved.`)) return;
    try {
      await deleteTask(task.id);
      cancelForm();
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed");
    }
  }

  function toggleDay(day: number) {
    setForm((f) => ({
      ...f,
      days_of_week: f.days_of_week.includes(day)
        ? f.days_of_week.filter((d) => d !== day)
        : [...f.days_of_week, day].sort(),
    }));
  }

  const showForm = creating || editing !== null;

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.45)",
          zIndex: 100,
        }}
      />

      {/* Modal dialog */}
      <div
        style={{
          position: "fixed",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 101,
          padding: "16px",
          pointerEvents: "none",
        }}
      >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: "480px",
          maxHeight: "90dvh",
          background: "var(--bg)",
          border: "1px solid var(--border)",
          borderRadius: "10px",
          boxShadow: "0 8px 40px rgba(0,0,0,0.25)",
          display: "flex",
          flexDirection: "column",
          pointerEvents: "auto",
          overflow: "hidden",
        }}
      >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "16px",
          borderBottom: "1px solid var(--border)",
        }}
      >
        <h2 style={{ fontSize: "16px" }}>Tasks</h2>
        <Tooltip label="Close">
          <button className="icon-btn" onClick={onClose}>
            <X size={18} />
          </button>
        </Tooltip>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: "auto", padding: "14px" }}>
        {showForm ? (
          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            <h3 style={{ fontSize: "15px" }}>{editing ? "Edit Task" : "New Task"}</h3>

            <div>
              <label>Name *</label>
              <input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                required
                autoFocus
                placeholder="Task name"
              />
            </div>

            <div>
              <label>Description</label>
              <textarea
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="Optional details"
                rows={2}
                style={{ resize: "vertical" }}
              />
            </div>

            <div>
              <label>Frequency</label>
              <select
                value={form.freq_type}
                onChange={(e) => setForm((f) => ({ ...f, freq_type: e.target.value as FreqType }))}
              >
                {(Object.keys(FREQ_LABELS) as FreqType[]).map((k) => (
                  <option key={k} value={k}>{FREQ_LABELS[k]}</option>
                ))}
              </select>
            </div>

            {form.freq_type === "days_of_week" && (
              <div>
                <label>Days</label>
                <div style={{ display: "flex", gap: "4px", flexWrap: "wrap" }}>
                  {WEEKDAYS.map((name, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => toggleDay(i)}
                      style={{
                        padding: "4px 9px",
                        fontSize: "13px",
                        background: form.days_of_week.includes(i) ? "var(--today-accent)" : "var(--bg-secondary)",
                        color: form.days_of_week.includes(i) ? "#fff" : "var(--fg)",
                        borderColor: form.days_of_week.includes(i) ? "var(--today-accent)" : "var(--border)",
                      }}
                    >
                      {name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div>
              <label>Target count (per period)</label>
              <input
                type="number"
                min="1"
                max="99"
                value={form.target_count}
                onChange={(e) => setForm((f) => ({ ...f, target_count: parseInt(e.target.value) || 1 }))}
              />
            </div>

            {error && (
              <div style={{ color: "var(--warn)", fontSize: "13px" }}>{error}</div>
            )}

            <div style={{ display: "flex", gap: "8px" }}>
              <button type="submit" className="primary" disabled={saving} style={{ flex: 1 }}>
                {saving ? "Saving…" : "Save"}
              </button>
              <button type="button" onClick={cancelForm}>Cancel</button>
            </div>

            {editing && (
              <button
                type="button"
                className="danger"
                onClick={() => handleDelete(editing)}
                style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "6px" }}
              >
                <Trash2 size={15} /> Delete task
              </button>
            )}
          </form>
        ) : (
          <>
            <button
              onClick={startCreate}
              style={{
                width: "100%",
                marginBottom: "14px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "6px",
                background: "var(--today-accent)",
                color: "#fff",
                borderColor: "var(--today-accent)",
              }}
            >
              <Plus size={16} /> New Task
            </button>

            {tasks.length === 0 ? (
              <div style={{ color: "var(--muted)", fontSize: "13px", textAlign: "center", paddingTop: "16px" }}>
                No tasks yet. Create one above.
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                {tasks.map((task) => (
                  <button
                    key={task.id}
                    onClick={() => startEdit(task)}
                    style={{
                      textAlign: "left",
                      padding: "10px 12px",
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                    }}
                  >
                    <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "2px" }}>
                      <span style={{ fontWeight: 500 }}>{task.name}</span>
                      <span style={{ fontSize: "12px", color: "var(--muted)" }}>
                        {FREQ_LABELS[task.freq_type]}
                        {task.target_count > 1 ? ` · ×${task.target_count}` : ""}
                      </span>
                    </div>
                    <ChevronRight size={15} style={{ color: "var(--muted)", flexShrink: 0 }} />
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </div>
      </div>
      </div>
    </>
  );
};
