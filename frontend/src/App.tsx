import { useState } from "react";
import { RefreshCw, Settings, CalendarDays, GalleryHorizontal, BarChart2, AlertTriangle } from "lucide-react";
import { DayStrip } from "./components/DayStrip.js";
import { CalendarView } from "./components/CalendarView.js";
import { StatsView } from "./components/StatsView.js";
import { TaskManager } from "./components/TaskManager.js";
import { Tooltip } from "./components/Tooltip.js";
import { useTaskStore } from "./hooks/useTaskStore.js";

type ViewMode = "strip" | "calendar" | "stats";

export function App() {
  const { days, tasks, loading, error, toggleCompletion, setCount, reload } = useTaskStore();
  const [showManager, setShowManager] = useState(false);
  const [view, setView] = useState<ViewMode>("strip");

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
      {/* Toolbar — border spans full width, inner content is page-constrained */}
      <header
        style={{
          borderBottom: "1px solid var(--border)",
          background: "var(--bg)",
          flexShrink: 0,
        }}
      >
        <div
          className="page-container"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "12px 16px",
          }}
        >
          <h1 style={{ fontSize: "17px", fontWeight: 700 }}>Daily</h1>
          <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
            {error && (
              <Tooltip placement="bottom" label={error}>
                <span style={{ display: "inline-flex", color: "var(--warn)", padding: "4px" }}>
                  <AlertTriangle size={18} />
                </span>
              </Tooltip>
            )}

            <Tooltip placement="bottom" label="Strip view">
              <button
                className="icon-btn"
                onClick={() => setView("strip")}
                style={{
                  background: view === "strip" ? "var(--today-accent)" : undefined,
                  color: view === "strip" ? "#fff" : undefined,
                  borderColor: view === "strip" ? "var(--today-accent)" : undefined,
                }}
              >
                <GalleryHorizontal size={18} />
              </button>
            </Tooltip>

            <Tooltip placement="bottom" label="Calendar view">
              <button
                className="icon-btn"
                onClick={() => setView("calendar")}
                style={{
                  background: view === "calendar" ? "var(--today-accent)" : undefined,
                  color: view === "calendar" ? "#fff" : undefined,
                  borderColor: view === "calendar" ? "var(--today-accent)" : undefined,
                }}
              >
                <CalendarDays size={18} />
              </button>
            </Tooltip>

            <Tooltip placement="bottom" label="Stats">
              <button
                className="icon-btn"
                onClick={() => setView("stats")}
                style={{
                  background: view === "stats" ? "var(--today-accent)" : undefined,
                  color: view === "stats" ? "#fff" : undefined,
                  borderColor: view === "stats" ? "var(--today-accent)" : undefined,
                }}
              >
                <BarChart2 size={18} />
              </button>
            </Tooltip>

            <Tooltip placement="bottom" label="Refresh">
              <button className="icon-btn" onClick={reload}>
                <RefreshCw size={18} />
              </button>
            </Tooltip>

            <Tooltip placement="bottom" label="Manage tasks">
              <button
                className="icon-btn"
                onClick={() => setShowManager((v) => !v)}
                style={{
                  background: showManager ? "var(--today-accent)" : undefined,
                  color: showManager ? "#fff" : undefined,
                  borderColor: showManager ? "var(--today-accent)" : undefined,
                }}
              >
                <Settings size={18} />
              </button>
            </Tooltip>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
        {loading && days.length === 0 ? (
          <div
            style={{
              flex: 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "var(--muted)",
            }}
          >
            Loading…
          </div>
        ) : view === "strip" ? (
          /* Strip: full-width, cards vertically centred */
          <DayStrip days={days} onToggle={toggleCompletion} onSetCount={setCount} />
        ) : (
          /* Calendar + Stats: page-container centres and caps width */
          <div
            className="page-container"
            style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}
          >
            {view === "stats" ? (
              <StatsView />
            ) : (
              <CalendarView days={days} onToggle={toggleCompletion} onSetCount={setCount} />
            )}
          </div>
        )}
      </main>

      {/* Task manager modal */}
      {showManager && (
        <TaskManager
          tasks={tasks}
          onClose={() => setShowManager(false)}
          onChanged={() => {
            setShowManager(false);
            reload();
          }}
        />
      )}
    </div>
  );
}
