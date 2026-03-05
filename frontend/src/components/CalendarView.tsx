import { useState, type FC } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { DayEntry } from "../types.js";
import { DayCard } from "./DayCard.js";
import { Tooltip } from "./Tooltip.js";

interface Props {
  days: DayEntry[];
  onToggle: (taskId: string, date: string, periodKey: string, currentlyComplete: boolean) => void;
  onSetCount: (taskId: string, date: string, periodKey: string, newCount: number) => void;
}

const MONTH_NAMES = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];
const DAY_HEADERS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];


export const CalendarView: FC<Props> = ({ days, onToggle, onSetCount }) => {
  const today = new Date();
  const [year, setYear] = useState(today.getUTCFullYear());
  const [month, setMonth] = useState(today.getUTCMonth());
  const [selectedDate, setSelectedDate] = useState<string | null>(
    today.toISOString().substring(0, 10)
  );

  const todayStr = today.toISOString().substring(0, 10);

  // Build a map from date string to DayEntry
  const dayMap = new Map<string, DayEntry>(days.map((d) => [d.date, d]));

  // Compute grid cells for this month
  const firstDay = new Date(Date.UTC(year, month, 1));
  const lastDay = new Date(Date.UTC(year, month + 1, 0));
  const startOffset = firstDay.getUTCDay(); // 0=Sun
  const totalDays = lastDay.getUTCDate();

  // Cells: leading nulls + day numbers
  const cells: (number | null)[] = [
    ...Array(startOffset).fill(null),
    ...Array.from({ length: totalDays }, (_, i) => i + 1),
  ];
  // Pad to complete last row
  while (cells.length % 7 !== 0) cells.push(null);

  function prevMonth() {
    if (month === 0) { setYear(y => y - 1); setMonth(11); }
    else setMonth(m => m - 1);
    setSelectedDate(null);
  }
  function nextMonth() {
    if (month === 11) { setYear(y => y + 1); setMonth(0); }
    else setMonth(m => m + 1);
    setSelectedDate(null);
  }

  function cellDateStr(dayNum: number) {
    return `${year}-${String(month + 1).padStart(2, "0")}-${String(dayNum).padStart(2, "0")}`;
  }

  const selectedEntry = selectedDate ? dayMap.get(selectedDate) : undefined;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        overflow: "hidden",
      }}
    >
      {/* Month navigation */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "12px 20px",
          borderBottom: "1px solid var(--border)",
          flexShrink: 0,
        }}
      >
        <Tooltip label="Previous month">
          <button className="icon-btn" onClick={prevMonth}>
            <ChevronLeft size={18} />
          </button>
        </Tooltip>
        <span style={{ fontWeight: 700, fontSize: "16px" }}>
          {MONTH_NAMES[month]} {year}
        </span>
        <Tooltip label="Next month">
          <button className="icon-btn" onClick={nextMonth}>
            <ChevronRight size={18} />
          </button>
        </Tooltip>
      </div>

      <div style={{ flex: 1, overflow: "auto", padding: "16px" }}>
        {/* Day-of-week headers */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(7, 1fr)",
            gap: "4px",
            marginBottom: "4px",
          }}
        >
          {DAY_HEADERS.map((h) => (
            <div
              key={h}
              style={{
                textAlign: "center",
                fontSize: "11px",
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                color: "var(--muted)",
                padding: "4px 0",
              }}
            >
              {h}
            </div>
          ))}
        </div>

        {/* Calendar grid */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(7, 1fr)",
            gap: "4px",
          }}
        >
          {cells.map((dayNum, i) => {
            if (dayNum === null) {
              return <div key={`empty-${i}`} />;
            }
            const dateStr = cellDateStr(dayNum);
            const entry = dayMap.get(dateStr);
            const isToday = dateStr === todayStr;
            const isSelected = dateStr === selectedDate;

            const completed = entry ? entry.tasks.filter(t => t.completion_state !== "none").length : 0;
            const total = entry ? entry.tasks.length : 0;
            const allDone = total > 0 && completed === total;
            const hasWarning = entry ? entry.tasks.some(t => t.missed_streak >= 2) : false;
            const isPast = dateStr < todayStr;

            return (
              <button
                key={dateStr}
                onClick={() => setSelectedDate(isSelected ? null : dateStr)}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "3px",
                  padding: "6px 2px",
                  minHeight: "56px",
                  borderRadius: "var(--radius)",
                  border: isSelected
                    ? `2px solid var(--today-accent)`
                    : isToday
                    ? `2px solid var(--today-accent)`
                    : allDone
                    ? `1px solid var(--success)`
                    : "1px solid var(--border)",
                  background: isSelected
                    ? "color-mix(in srgb, var(--today-accent) 12%, var(--bg))"
                    : isToday
                    ? "color-mix(in srgb, var(--today-accent) 6%, var(--bg))"
                    : "var(--card-bg)",
                  opacity: isPast && !isToday && total === 0 ? 0.5 : 1,
                  cursor: "pointer",
                }}
              >
                <span
                  style={{
                    fontSize: "14px",
                    fontWeight: isToday ? 800 : 500,
                    color: isToday ? "var(--today-accent-text)" : "var(--fg)",
                    lineHeight: 1,
                  }}
                >
                  {dayNum}
                </span>

                {/* Progress dots */}
                {total > 0 && (
                  <div style={{ display: "flex", gap: "2px", alignItems: "center" }}>
                    {allDone ? (
                      <span style={{ fontSize: "9px", color: "var(--success)", fontWeight: 700 }}>✓</span>
                    ) : hasWarning ? (
                      <span style={{ fontSize: "9px", color: "var(--warn)", fontWeight: 700 }}>!</span>
                    ) : (
                      <>
                        {Array.from({ length: Math.min(total, 5) }, (_, i) => (
                          <div
                            key={i}
                            style={{
                              width: "5px",
                              height: "5px",
                              borderRadius: "50%",
                              background: i < completed ? "var(--today-accent)" : "var(--border)",
                            }}
                          />
                        ))}
                        {total > 5 && (
                          <span style={{ fontSize: "8px", color: "var(--muted)" }}>+{total - 5}</span>
                        )}
                      </>
                    )}
                  </div>
                )}

                <span style={{ fontSize: "10px", color: "var(--muted)", lineHeight: 1 }}>
                  {total > 0 ? `${completed}/${total}` : ""}
                </span>
              </button>
            );
          })}
        </div>

        {/* Selected day detail */}
        {selectedDate && (
          <div style={{ marginTop: "20px" }}>
            <div
              style={{
                fontSize: "13px",
                fontWeight: 600,
                color: "var(--muted)",
                marginBottom: "10px",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
              }}
            >
              {new Date(selectedDate + "T00:00:00Z").toLocaleDateString("en-US", {
                weekday: "long", month: "long", day: "numeric", timeZone: "UTC"
              })}
            </div>
            {selectedEntry ? (
              <DayCard
                day={selectedEntry}
                isToday={selectedDate === todayStr}
                onToggle={onToggle}
                onSetCount={onSetCount}
              />
            ) : (
              <div style={{ color: "var(--muted)", fontSize: "13px" }}>
                No data for this date (outside loaded range).
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
