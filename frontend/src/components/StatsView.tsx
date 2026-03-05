import { useState, useEffect, type FC } from "react";
import { ArrowLeft } from "lucide-react";
import type { TaskStats } from "../types.js";
import { fetchStats } from "../api.js";
import { Tooltip } from "./Tooltip.js";

const FREQ_LABELS: Record<string, string> = {
  daily: "Daily",
  days_of_week: "Specific days",
  weekly: "Weekly",
  monthly: "Monthly",
};


const HourHistogram: FC<{ data: number[] }> = ({ data }) => {
  const max = Math.max(...data, 1);
  // Reorder by local hour
  const localOrdered = Array.from({ length: 24 }, (_, localH) => {
    // Find which UTC hour maps to this local hour
    const d = new Date();
    d.setHours(localH, 0, 0, 0);
    const utcH = d.getUTCHours();
    return { localH, count: data[utcH] };
  });

  const totalCompletions = data.reduce((a, b) => a + b, 0);
  if (totalCompletions === 0) {
    return <div style={{ color: "var(--muted)", fontSize: "13px" }}>No completions yet.</div>;
  }

  return (
    <div>
      <div style={{ fontSize: "12px", color: "var(--muted)", marginBottom: "6px" }}>
        Completions by time of day (local time)
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(24, 1fr)",
          gap: "2px",
          alignItems: "flex-end",
          height: "48px",
        }}
      >
        {localOrdered.map(({ localH, count }) => (
          <Tooltip key={localH} label={`${String(localH).padStart(2, "0")}:00 — ${count}`} placement="top">
            <div
              style={{
                height: `${Math.max((count / max) * 100, count > 0 ? 8 : 0)}%`,
                minHeight: count > 0 ? "3px" : "0",
                background: count > 0 ? "var(--today-accent)" : "var(--border)",
                borderRadius: "2px 2px 0 0",
                cursor: count > 0 ? "default" : undefined,
                width: "100%",
              }}
            />
          </Tooltip>
        ))}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "10px", color: "var(--muted)", marginTop: "2px" }}>
        <span>12 am</span>
        <span>6 am</span>
        <span>12 pm</span>
        <span>6 pm</span>
        <span>11 pm</span>
      </div>
    </div>
  );
};

const RateBar: FC<{ rate: number }> = ({ rate }) => {
  const pct = Math.round(rate * 100);
  const color = pct >= 80 ? "var(--success)" : pct >= 40 ? "var(--today-accent)" : "var(--warn)";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
      <div
        style={{
          flex: 1,
          height: "8px",
          background: "var(--border)",
          borderRadius: "4px",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: `${pct}%`,
            height: "100%",
            background: color,
            borderRadius: "4px",
            transition: "width 0.4s ease",
          }}
        />
      </div>
      <span style={{ fontSize: "13px", fontWeight: 700, color, minWidth: "36px", textAlign: "right" }}>
        {pct}%
      </span>
    </div>
  );
};

const TaskDetail: FC<{ stats: TaskStats; onBack: () => void }> = ({ stats, onBack }) => {
  const { task, total_completions, last_completed_at, first_completion_at, possible_days, completion_rate, completions_by_hour, completion_dates } = stats;

  function formatDate(ds: string | null) {
    if (!ds) return "—";
    return new Date(ds + "T00:00:00Z").toLocaleDateString("en-US", {
      year: "numeric", month: "short", day: "numeric", timeZone: "UTC",
    });
  }

  // Simple activity grid: last 12 weeks (84 days) like a mini GitHub contribution graph
  const today = new Date();
  const completionSet = new Set(completion_dates);
  const cells: Array<{ date: string; done: boolean; applicable: boolean }> = [];
  for (let i = 83; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const ds = d.toISOString().substring(0, 10);
    // Simple applicable check: just use presence in completion_dates for coloring
    cells.push({ date: ds, done: completionSet.has(ds), applicable: ds >= task.created_at.substring(0, 10) });
  }

  return (
    <div style={{ padding: "16px", display: "flex", flexDirection: "column", gap: "20px", maxWidth: "700px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
        <button className="icon-btn" onClick={onBack}>
          <ArrowLeft size={18} />
        </button>
        <h2 style={{ fontSize: "18px" }}>{task.name}</h2>
        {task.deleted_at && (
          <span style={{ fontSize: "12px", color: "var(--warn)", border: "1px solid var(--warn)", borderRadius: "4px", padding: "1px 6px" }}>
            Archived
          </span>
        )}
      </div>

      {task.description && (
        <p style={{ color: "var(--muted)", fontSize: "14px" }}>{task.description}</p>
      )}

      {/* Key stats grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))",
          gap: "10px",
        }}
      >
        {[
          { label: "Created", value: formatDate(task.created_at.substring(0, 10)) },
          { label: "First completion", value: formatDate(first_completion_at) },
          { label: "Last completion", value: formatDate(last_completed_at) },
          { label: "Total completions", value: String(total_completions) },
          { label: "Possible periods", value: String(possible_days) },
          { label: "Frequency", value: FREQ_LABELS[task.freq_type] ?? task.freq_type },
        ].map(({ label, value }) => (
          <div
            key={label}
            style={{
              background: "var(--bg-secondary)",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius)",
              padding: "10px 12px",
            }}
          >
            <div style={{ fontSize: "11px", color: "var(--muted)", marginBottom: "4px" }}>{label}</div>
            <div style={{ fontWeight: 700, fontSize: "15px" }}>{value}</div>
          </div>
        ))}
      </div>

      {/* Completion rate */}
      <div>
        <div style={{ fontSize: "12px", color: "var(--muted)", marginBottom: "6px" }}>
          Completion rate ({total_completions} / {possible_days} periods)
        </div>
        <RateBar rate={completion_rate} />
      </div>

      {/* Activity grid */}
      <div>
        <div style={{ fontSize: "12px", color: "var(--muted)", marginBottom: "8px" }}>
          Activity — last 12 weeks
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(84, 1fr)", gap: "2px" }}>
          {cells.map(({ date, done, applicable }) => (
            <Tooltip key={date} label={`${date}${done ? " ✓" : ""}`} placement="top">
              <div
                style={{
                  aspectRatio: "1",
                  borderRadius: "2px",
                  background: !applicable
                    ? "transparent"
                    : done
                    ? "var(--today-accent)"
                    : "var(--border)",
                }}
              />
            </Tooltip>
          ))}
        </div>
      </div>

      {/* Hour histogram */}
      <HourHistogram data={completions_by_hour} />
    </div>
  );
};

export const StatsView: FC = () => {
  const [stats, setStats] = useState<TaskStats[] | null>(null);
  const [selected, setSelected] = useState<TaskStats | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchStats()
      .then(setStats)
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load stats"));
  }, []);

  if (error) {
    return <div style={{ padding: "24px", color: "var(--warn)" }}>{error}</div>;
  }

  if (!stats) {
    return (
      <div style={{ padding: "24px", color: "var(--muted)", display: "flex", alignItems: "center", justifyContent: "center", height: "100%" }}>
        Loading…
      </div>
    );
  }

  if (selected) {
    return <TaskDetail stats={selected} onBack={() => setSelected(null)} />;
  }

  return (
    <div style={{ padding: "16px", overflowY: "auto", height: "100%" }}>
      <h2 style={{ fontSize: "16px", marginBottom: "14px" }}>Task stats</h2>
      {stats.length === 0 ? (
        <div style={{ color: "var(--muted)", fontSize: "14px" }}>No tasks yet.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "6px", maxWidth: "600px" }}>
          {stats.map((s) => (
            <button
              key={s.task.id}
              onClick={() => setSelected(s)}
              style={{
                textAlign: "left",
                padding: "12px 14px",
                display: "flex",
                flexDirection: "column",
                gap: "6px",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: "8px" }}>
                <span style={{ fontWeight: 600, fontSize: "15px" }}>{s.task.name}</span>
                <span style={{ fontSize: "12px", color: "var(--muted)", flexShrink: 0 }}>
                  {s.total_completions > 0
                    ? `Last: ${new Date(s.last_completed_at! + "T00:00:00Z").toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })}`
                    : "Never completed"}
                </span>
              </div>
              <RateBar rate={s.completion_rate} />
              <div style={{ fontSize: "12px", color: "var(--muted)" }}>
                {s.total_completions} completion{s.total_completions !== 1 ? "s" : ""} · {FREQ_LABELS[s.task.freq_type]}
                {s.task.deleted_at ? " · archived" : ""}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
