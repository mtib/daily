import type { FC } from "react";
import type { DayEntry } from "../types.js";
import { TaskItem } from "./TaskItem.js";
import { ProgressRing } from "./ProgressRing.js";

interface Props {
  day: DayEntry;
  isToday: boolean;
  compact?: boolean;
  onToggle: (taskId: string, date: string, periodKey: string, currentlyComplete: boolean) => void;
  onSetCount?: (taskId: string, date: string, periodKey: string, newCount: number) => void;
}

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function formatDate(dateStr: string): { weekday: string; day: number; month: string } {
  const d = new Date(dateStr + "T00:00:00Z");
  return {
    weekday: DAYS[d.getUTCDay()],
    day: d.getUTCDate(),
    month: MONTHS[d.getUTCMonth()],
  };
}

export const DayCard: FC<Props> = ({ day, isToday, compact = false, onToggle, onSetCount }) => {
  const today = new Date().toISOString().substring(0, 10);
  const isPast = day.date < today;
  const isFuture = day.date > today;

  const completed = day.tasks.filter((t) => t.completion_state !== "none").length;
  const total = day.tasks.length;
  const allDone = total > 0 && completed === total;

  const { weekday, day: dayNum, month } = formatDate(day.date);

  const cardWidth = compact ? "160px" : isToday ? "310px" : "290px";

  return (
    <div
      data-date={day.date}
      style={{
        scrollSnapAlign: "center",
        flexShrink: 0,
        width: cardWidth,
        minHeight: compact ? "80px" : "220px",
        background: "var(--card-bg)",
        border: allDone ? "var(--card-border-complete)" : "var(--card-border)",
        borderRadius: "var(--radius)",
        boxShadow: isToday ? `0 0 0 2px var(--today-accent)` : "var(--shadow)",
        display: "flex",
        flexDirection: "column",
        transition: "border 0.2s",
        overflow: "hidden",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: compact ? "8px 10px" : "12px 16px 10px",
          borderBottom: compact ? "none" : "1px solid var(--border)",
          background: isToday ? "color-mix(in srgb, var(--today-accent) 8%, var(--card-bg))" : undefined,
        }}
      >
        <div>
          <div
            style={{
              fontSize: "11px",
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              color: isToday ? "var(--today-accent-text)" : "var(--muted)",
            }}
          >
            {weekday}{isToday ? " · Today" : ""}
          </div>
          <div style={{ fontSize: compact ? "16px" : "22px", fontWeight: 700, lineHeight: 1.1 }}>
            {dayNum}
          </div>
          {!compact && (
            <div style={{ fontSize: "11px", color: "var(--muted)" }}>{month}</div>
          )}
        </div>
        {!compact && <ProgressRing completed={completed} total={total} size={40} />}
        {compact && total > 0 && (
          <div style={{ fontSize: "11px", color: allDone ? "var(--success)" : "var(--muted)" }}>
            {completed}/{total}
          </div>
        )}
      </div>

      {/* Task list — hidden in compact mode */}
      {!compact && (
        <div
          style={{
            padding: "4px 16px 12px",
            flex: 1,
            overflowY: "auto",
          }}
        >
          {day.tasks.length === 0 ? (
            <div style={{ color: "var(--muted)", fontSize: "13px", textAlign: "center", paddingTop: "20px" }}>
              No tasks
            </div>
          ) : (
            day.tasks.map((entry) => (
              <TaskItem
                key={entry.task.id}
                entry={entry}
                date={day.date}
                isPast={isPast}
                isFuture={isFuture}
                onToggle={onToggle}
                onSetCount={onSetCount}
              />
            ))
          )}
        </div>
      )}

      {/* Footer badge for past/future */}
      {!compact && (isPast || isFuture) && (
        <div
          style={{
            textAlign: "center",
            fontSize: "11px",
            color: "var(--muted)",
            padding: "5px",
            borderTop: "1px solid var(--border)",
          }}
        >
          {isPast ? "Past" : "Upcoming"}
        </div>
      )}
    </div>
  );
};
