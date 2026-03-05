import type { FC } from "react";
import { Check, ChevronLeft, ChevronRight, Square, Minus, Plus } from "lucide-react";
import type { DayTaskEntry } from "../types.js";
import { Tooltip } from "./Tooltip.js";

interface Props {
  entry: DayTaskEntry;
  date: string;
  isPast: boolean;
  isFuture: boolean;
  onToggle: (taskId: string, date: string, periodKey: string, currentlyComplete: boolean) => void;
  onSetCount?: (taskId: string, date: string, periodKey: string, newCount: number) => void;
}

export const TaskItem: FC<Props> = ({ entry, date, isPast, isFuture, onToggle, onSetCount }) => {
  const { task, completion, period_key, missed_streak, completion_state } = entry;
  const currentCount = completion?.count ?? 0;
  // For multi-count tasks, only consider the task complete once the count hits the target.
  const isComplete =
    task.target_count > 1
      ? currentCount >= task.target_count
      : completion_state !== "none";
  const disabled = isFuture || isPast;

  let CheckIcon: FC<{ size: number }> = ({ size }) => <Square size={size} />;
  let tooltipLabel = "Mark as complete";

  switch (completion_state) {
    case "this_day":
      CheckIcon = ({ size }) => <Check size={size} />;
      tooltipLabel = "Completed — click to unmark";
      break;
    case "earlier_in_period":
      CheckIcon = ({ size }) => <ChevronLeft size={size} />;
      tooltipLabel = `Completed earlier this ${task.freq_type === "weekly" ? "week" : "month"} — click to unmark`;
      break;
    case "later_in_period":
      CheckIcon = ({ size }) => <ChevronRight size={size} />;
      tooltipLabel = `Completed later this ${task.freq_type === "weekly" ? "week" : "month"} — click to unmark`;
      break;
  }

  const showStreak = !isComplete && missed_streak > 0 && !isFuture;
  const isWarning = showStreak && missed_streak >= 2;

  const checkColor = isWarning ? "var(--warn)" : "var(--today-accent)";

  function handleDecrement() {
    if (disabled || !onSetCount) return;
    onSetCount(task.id, date, period_key, currentCount - 1);
  }

  function handleIncrement() {
    if (disabled || !onSetCount) return;
    onSetCount(task.id, date, period_key, currentCount + 1);
  }

  function handleToggle() {
    if (disabled) return;
    onToggle(task.id, date, period_key, completion_state !== "none");
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
          label={disabled ? (isFuture ? "Future task" : "Past task") : tooltipLabel}
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
            <CheckIcon size={16} />
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
