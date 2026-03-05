import { useState, useCallback, type FC } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { DayEntry } from "../types.js";
import { DayCard } from "./DayCard.js";
import { Tooltip } from "./Tooltip.js";
import { fetchDay } from "../api.js";
import { editableTodayStr } from "../hooks/useTaskStore.js";

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
  const localToday = (d = new Date()) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  };
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [selectedDate, setSelectedDate] = useState<string | null>(
    localToday()
  );
  const [extraEntries, setExtraEntries] = useState<Map<string, DayEntry | "loading">>(new Map());

  const todayStr = localToday();

  // Build a map from date string to DayEntry
  const dayMap = new Map<string, DayEntry>(days.map((d) => [d.date, d]));

  const loadExtraDay = useCallback(async (date: string) => {
    setExtraEntries(prev => new Map(prev).set(date, "loading"));
    const entry = await fetchDay(date, editableTodayStr());
    setExtraEntries(prev => new Map(prev).set(date, entry));
  }, []);

  function handleSelectDate(date: string, isSelected: boolean) {
    setSelectedDate(isSelected ? null : date);
    if (!isSelected && !dayMap.has(date)) {
      loadExtraDay(date);
    }
  }

  async function handleToggle(taskId: string, date: string, periodKey: string, currentlyComplete: boolean) {
    await onToggle(taskId, date, periodKey, currentlyComplete);
    if (extraEntries.has(date)) loadExtraDay(date);
  }

  async function handleSetCount(taskId: string, date: string, periodKey: string, newCount: number) {
    await onSetCount(taskId, date, periodKey, newCount);
    if (extraEntries.has(date)) loadExtraDay(date);
  }

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
    setExtraEntries(new Map());
  }
  function nextMonth() {
    if (month === 11) { setYear(y => y + 1); setMonth(0); }
    else setMonth(m => m + 1);
    setSelectedDate(null);
    setExtraEntries(new Map());
  }

  function cellDateStr(dayNum: number) {
    return `${year}-${String(month + 1).padStart(2, "0")}-${String(dayNum).padStart(2, "0")}`;
  }

  const selectedExtraRaw = selectedDate ? extraEntries.get(selectedDate) : undefined;
  const selectedEntry = selectedDate
    ? (dayMap.get(selectedDate) ?? (selectedExtraRaw !== "loading" ? selectedExtraRaw : undefined))
    : undefined;
  const selectedLoading = selectedExtraRaw === "loading";

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
                onClick={() => handleSelectDate(dateStr, isSelected)}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "3px",
                  padding: "6px 2px",
                  minHeight: "56px",
                  borderRadius: "var(--radius)",
                  border: isToday
                    ? `2px solid var(--today-accent)`
                    : isSelected
                    ? `2px solid var(--fg)`
                    : allDone
                    ? `1px solid var(--success)`
                    : "1px solid var(--border)",
                  background: isToday
                    ? "color-mix(in srgb, var(--today-accent) 6%, var(--bg))"
                    : isSelected
                    ? "color-mix(in srgb, var(--fg) 8%, var(--bg))"
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
            {selectedLoading ? (
              <div style={{ color: "var(--muted)", fontSize: "13px" }}>Loading…</div>
            ) : selectedEntry ? (
              <DayCard
                day={selectedEntry}
                isToday={selectedDate === todayStr}
                onToggle={handleToggle}
                onSetCount={handleSetCount}
              />
            ) : (
              <div style={{ color: "var(--muted)", fontSize: "13px" }}>No tasks for this date.</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
