import { useState, type FC } from "react";
import { Check, ChevronLeft, ChevronRight, Minus, Plus } from "lucide-react";
import type { DayTaskEntry } from "../types.js";
import { Tooltip } from "./Tooltip.js";

interface TimeModalProps {
  taskName: string;
  date: string;
  onConfirm: (isoTimestamp: string) => void;
  onCancel: () => void;
}

const CorrectionTimeModal: FC<TimeModalProps> = ({ taskName, date, onConfirm, onCancel }) => {
  const now = new Date();
  const defaultTime = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  const [time, setTime] = useState(defaultTime);

  function handleConfirm() {
    const [h, m] = time.split(":").map(Number);
    // Construct as local time on that date (no trailing Z = local timezone)
    const dt = new Date(`${date}T${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00`);
    onConfirm(dt.toISOString());
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") handleConfirm();
    if (e.key === "Escape") onCancel();
  }

  const displayDate = new Date(date + "T00:00:00Z").toLocaleDateString("en-US", {
    weekday: "long", month: "long", day: "numeric", timeZone: "UTC",
  });

  return (
    <div
      onKeyDown={handleKeyDown}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1000,
        background: "color-mix(in srgb, var(--bg) 80%, transparent)",
        backdropFilter: "blur(4px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}
    >
      <div
        style={{
          background: "var(--card-bg)",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius)",
          boxShadow: "var(--shadow)",
          padding: "28px 32px",
          width: "100%",
          maxWidth: "360px",
          display: "flex",
          flexDirection: "column",
          gap: "20px",
        }}
      >
        <div>
          <div style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--warn)", marginBottom: "6px" }}>
            Correction
          </div>
          <div style={{ fontSize: "17px", fontWeight: 700, marginBottom: "2px" }}>{taskName}</div>
          <div style={{ fontSize: "13px", color: "var(--muted)" }}>{displayDate}</div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          <label style={{ fontSize: "13px", fontWeight: 600, color: "var(--muted)" }}>
            Time completed (local time)
          </label>
          <input
            type="time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
            autoFocus
            style={{
              fontSize: "22px",
              fontWeight: 700,
              padding: "10px 14px",
              borderRadius: "var(--radius)",
              border: "1px solid var(--border)",
              background: "var(--bg)",
              color: "var(--fg)",
              width: "100%",
            }}
          />
        </div>

        <div style={{ display: "flex", gap: "8px" }}>
          <button
            onClick={onCancel}
            style={{
              flex: 1,
              padding: "10px",
              borderRadius: "var(--radius)",
              border: "1px solid var(--border)",
              background: "transparent",
              color: "var(--muted)",
              fontSize: "14px",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            style={{
              flex: 1,
              padding: "10px",
              borderRadius: "var(--radius)",
              border: "1px solid var(--warn)",
              background: "var(--warn)",
              color: "#fff",
              fontSize: "14px",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Save correction
          </button>
        </div>
      </div>
    </div>
  );
};

interface Props {
  entry: DayTaskEntry;
  date: string;
  isPast: boolean;
  isFuture: boolean;
  correctionMode?: boolean;
  onToggle: (taskId: string, date: string, periodKey: string, currentlyComplete: boolean, completedAt?: string) => void;
  onSetCount?: (taskId: string, date: string, periodKey: string, newCount: number, completedAt?: string) => void;
}

export const TaskItem: FC<Props> = ({ entry, date, isPast, isFuture, correctionMode = false, onToggle, onSetCount }) => {
  const { task, completion, period_key, missed_streak, completion_state } = entry;
  const currentCount = completion?.count ?? 0;
  // For multi-count tasks, only consider the task complete once the count hits the target.
  const isComplete =
    task.target_count > 1
      ? currentCount >= task.target_count
      : completion_state !== "none";
  const disabled = isFuture || (isPast && !correctionMode);

  const [pendingAction, setPendingAction] = useState<"toggle" | "increment" | null>(null);

  const periodWord = task.freq_type === "weekly" ? "week" : "month";
  const checkIcon =
    completion_state === "this_day" ? <Check size={16} /> :
    completion_state === "earlier_in_period" ? <ChevronLeft size={16} /> :
    completion_state === "later_in_period" ? <ChevronRight size={16} /> :
    null;
  const tooltipLabel =
    completion_state === "this_day" ? "Completed — click to unmark" :
    completion_state === "earlier_in_period" ? `Completed earlier this ${periodWord} — click to unmark` :
    completion_state === "later_in_period" ? `Completed later this ${periodWord} — click to unmark` :
    "Mark as complete";

  const showStreak = !isComplete && missed_streak > 0 && !isFuture;
  const isWarning = showStreak && missed_streak >= 2;

  const checkColor = isWarning ? "var(--warn)" : "var(--today-accent)";

  const needsTimePrompt = correctionMode && isPast;

  function handleDecrement() {
    if (disabled || !onSetCount) return;
    // Decrement never needs a timestamp
    onSetCount(task.id, date, period_key, currentCount - 1);
  }

  function handleIncrement() {
    if (disabled || !onSetCount) return;
    if (needsTimePrompt) { setPendingAction("increment"); return; }
    onSetCount(task.id, date, period_key, currentCount + 1);
  }

  function handleToggle() {
    if (disabled) return;
    const adding = completion_state === "none";
    if (needsTimePrompt && adding) { setPendingAction("toggle"); return; }
    onToggle(task.id, date, period_key, completion_state !== "none");
  }

  function handleModalConfirm(isoTimestamp: string) {
    setPendingAction(null);
    if (pendingAction === "toggle") {
      onToggle(task.id, date, period_key, false, isoTimestamp);
    } else if (pendingAction === "increment" && onSetCount) {
      onSetCount(task.id, date, period_key, currentCount + 1, isoTimestamp);
    }
  }

  const isAtTarget = currentCount >= task.target_count;

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "10px",
        padding: "7px 0",
        borderBottom: "1px solid color-mix(in srgb, var(--border) 60%, transparent)",
        opacity: isFuture ? 0.45 : 1,
      }}
    >
      {pendingAction && (
        <CorrectionTimeModal
          taskName={task.name}
          date={date}
          onConfirm={handleModalConfirm}
          onCancel={() => setPendingAction(null)}
        />
      )}
      {task.target_count > 1 ? (
        /* ── Multi-count: − count + ── */
        <div style={{ display: "flex", alignItems: "center", gap: "3px", flexShrink: 0 }}>
          <Tooltip label="Decrease" placement="top">
            <button
              onClick={handleDecrement}
              disabled={disabled || currentCount === 0}
              style={{
                width: "26px",
                height: "26px",
                padding: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "var(--muted)",
              }}
            >
              <Minus size={14} />
            </button>
          </Tooltip>

          <span
            style={{
              fontFamily: "monospace",
              fontSize: "13px",
              fontWeight: 700,
              minWidth: "36px",
              textAlign: "center",
              color: "var(--today-accent)",
            }}
          >
            {currentCount}/{task.target_count}
          </span>

          <Tooltip label={isAtTarget ? "Target reached" : "Increase"} placement="top">
            <button
              onClick={handleIncrement}
              disabled={disabled || isAtTarget}
              style={{
                width: "26px",
                height: "26px",
                padding: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "var(--today-accent)",
                borderColor: "var(--today-accent)",
              }}
            >
              <Plus size={14} />
            </button>
          </Tooltip>
        </div>
      ) : (
        /* ── Single: checkbox icon ── */
        <Tooltip
          label={disabled ? (isFuture ? "Future task" : "Past task") : correctionMode && isPast ? `Correction: ${tooltipLabel}` : tooltipLabel}
          placement="top"
        >
          <button
            onClick={handleToggle}
            disabled={disabled}
            style={{
              width: "28px",
              height: "28px",
              padding: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
              color: checkColor,
              borderColor: checkColor,
              background: isComplete
                ? "color-mix(in srgb, var(--today-accent) 12%, transparent)"
                : "transparent",
            }}
          >
            {checkIcon}
          </button>
        </Tooltip>
      )}

      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontWeight: 500,
            fontSize: "15px",
            textDecoration: isComplete ? "line-through" : "none",
            color:
              isComplete
                ? "var(--muted)"
                : isWarning
                ? "var(--warn)"
                : "var(--fg)",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {task.name}
        </div>
        {task.description && (
          <div style={{ fontSize: "12px", color: "var(--muted)", marginTop: "1px" }}>
            {task.description}
          </div>
        )}
      </div>

      {showStreak && (
        <Tooltip
          label={`Missed ${missed_streak} applicable day${missed_streak > 1 ? "s" : ""} in a row`}
          placement="top"
        >
          <span
            style={{
              fontSize: "11px",
              fontWeight: 700,
              color: "var(--warn)",
              background: "var(--warn-bg)",
              border: "1px solid var(--warn)",
              borderRadius: "999px",
              padding: "2px 7px",
              flexShrink: 0,
              cursor: "default",
            }}
          >
            {missed_streak}d
          </span>
        </Tooltip>
      )}
    </div>
  );
};
